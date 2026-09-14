const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');
const { jwtSecret, jwtExpiresIn } = require('../config/env');

function issueTokenPayload(userId, userType) {
  return { sub: userId, type: userType, jti: crypto.randomUUID() };
}

// POST /api/auth/login
// Body: { email, password, force }  — `force` is only true when the
// client already showed the "already logged in elsewhere" modal and
// the user confirmed force-logout (Spec §8.1).
async function login(req, res, next) {
  try {
    const { email, password, force } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    // Try employee first, then admin
    let user = await prisma.employee.findUnique({ where: { email } });
    let userType = 'EMPLOYEE';
    if (!user) {
      user = await prisma.admin.findUnique({ where: { email } });
      userType = 'ADMIN';
    }
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (userType === 'EMPLOYEE' && !user.active) {
      return res.status(403).json({ error: 'This account has been deactivated' });
    }
    if (userType === 'ADMIN' && !user.active) {
      return res.status(403).json({ error: 'This admin account has been deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid email or password' });

    const existingSession = await prisma.session.findFirst({
      where: userType === 'EMPLOYEE' ? { employeeId: user.id } : { adminId: user.id },
    });

    if (existingSession && !force) {
      return res.status(409).json({ error: 'ALREADY_LOGGED_IN', message: 'This account is active on another device' });
    }
    if (existingSession && force) {
      await prisma.session.delete({ where: { id: existingSession.id } });
    }

    if (userType === 'ADMIN' && !user.employeeId) {
      const linkedEmployee = await prisma.employee.create({
        data: { name: user.name, email: 'admin-' + user.id + '@internal', password: user.password },
      });
      user = await prisma.admin.update({ where: { id: user.id }, data: { employeeId: linkedEmployee.id } });
    }

    const payload = issueTokenPayload(user.id, userType);
    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });

    await prisma.session.create({
      data: {
        token: payload.jti,
        userType,
        employeeId: userType === 'EMPLOYEE' ? user.id : null,
        adminId: userType === 'ADMIN' ? user.id : null,
      },
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, type: userType, avatarUrl: user.avatarUrl, role: user.role || null },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me — used on app load to check for an existing valid
// session instead of always showing the login screen (fixes the
// "refresh forces re-login" gap flagged during frontend review).
async function me(req, res, next) {
  try {
    let user;
    if (req.user.type === 'EMPLOYEE') {
      user = await prisma.employee.findUnique({ where: { id: req.user.id } });
    } else {
      user = await prisma.admin.findUnique({ where: { id: req.user.id } });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user.id, name: user.name, email: user.email, type: req.user.type, avatarUrl: user.avatarUrl, role: user.role || null } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/auth/me/email   Body: { newEmail, currentPassword }
// Works for both EMPLOYEE and ADMIN — requires current password to confirm identity.
async function updateEmail(req, res, next) {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) {
      return res.status(400).json({ error: 'newEmail and currentPassword are required' });
    }

    const table = req.user.type === 'EMPLOYEE' ? prisma.employee : prisma.admin;
    const user = await table.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Account not found' });

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Current password is incorrect' });

    const existingWithEmail = await table.findUnique({ where: { email: newEmail } });
    if (existingWithEmail && existingWithEmail.id !== user.id) {
      return res.status(409).json({ error: 'That email is already in use' });
    }

    const updated = await table.update({ where: { id: req.user.id }, data: { email: newEmail } });
    res.json({ email: updated.email });
  } catch (err) { next(err); }
}

// PATCH /api/auth/me/name   Body: { name }
async function updateName(req, res, next) {
  try {
    if (req.user.type !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can change their own name. Ask your admin to update it for you.' });
    }
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

    const updated = await prisma.admin.update({ where: { id: req.user.id }, data: { name: name.trim() } });
    res.json({ name: updated.name });
  } catch (err) { next(err); }
}

module.exports = { login, logout, me, updateEmail, updateName };