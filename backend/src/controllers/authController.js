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
      user: { id: user.id, name: user.name, email: user.email, type: userType },
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
    res.json({ user: { id: user.id, name: user.name, email: user.email, type: req.user.type } });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me };