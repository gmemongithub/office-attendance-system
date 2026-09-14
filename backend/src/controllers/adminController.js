const bcrypt = require('bcrypt');
const prisma = require('../config/db');

async function createAdmin(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    const existing = await prisma.admin.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An admin with this email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({ data: { name, email, password: hash } });
    res.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (err) { next(err); }
}

async function createEmployee(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email, and password are required' });
    }
    const existing = await prisma.employee.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An employee with this email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const employee = await prisma.employee.create({ data: { name, email, password: hash } });
    res.json({ employee: { id: employee.id, name: employee.name, email: employee.email, active: employee.active } });
  } catch (err) { next(err); }
}

async function listEmployees(req, res, next) {
  try {
    const admins = await prisma.admin.findMany({ select: { employeeId: true } });
    const adminLinkedIds = admins.map(a => a.employeeId).filter(Boolean);

    const employees = await prisma.employee.findMany({
      where: { id: { notIn: adminLinkedIds } },
      select: { id: true, name: true, email: true, active: true, avatarUrl: true, dutyStartTimeOverride: true, createdAt: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
    res.json({ employees });
  } catch (err) { next(err); }
}

async function getEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, active: true, avatarUrl: true, dutyStartTimeOverride: true, createdAt: true },
    });
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    const settings = await prisma.globalSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    const effectiveDutyStartTime = employee.dutyStartTimeOverride || settings.defaultDutyStartTime;
    res.json({ employee: Object.assign({}, employee, { effectiveDutyStartTime }) });
  } catch (err) { next(err); }
}

async function updateEmployee(req, res, next) {
  try {
    const before = await prisma.employee.findUnique({ where: { id: req.params.id }, select: { name: true, dutyStartTimeOverride: true } });
    const { name, dutyStartTimeOverride } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (dutyStartTimeOverride !== undefined) data.dutyStartTimeOverride = dutyStartTimeOverride || null;

    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });

    await prisma.auditLog.create({
      data: {
        adminId: req.user.id, employeeId: employee.id,
        action: 'UPDATE_EMPLOYEE',
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify({ name: employee.name, dutyStartTimeOverride: employee.dutyStartTimeOverride }),
        reason: 'Profile/duty-time updated via admin panel',
      },
    });

    res.json({ employee: { id: employee.id, name: employee.name, dutyStartTimeOverride: employee.dutyStartTimeOverride } });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({ where: { id: req.params.id }, data: { password: hash } });
    await prisma.session.deleteMany({ where: { employeeId: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function deactivateEmployee(req, res, next) {
  try {
    await prisma.employee.update({ where: { id: req.params.id }, data: { active: false } });
    await prisma.session.deleteMany({ where: { employeeId: req.params.id } });
    await prisma.auditLog.create({
      data: { adminId: req.user.id, employeeId: req.params.id, action: 'DEACTIVATE_EMPLOYEE', reason: 'Deactivated via admin panel' },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function reactivateEmployee(req, res, next) {
  try {
    await prisma.employee.update({ where: { id: req.params.id }, data: { active: true } });
    await prisma.auditLog.create({
      data: { adminId: req.user.id, employeeId: req.params.id, action: 'REACTIVATE_EMPLOYEE', reason: 'Reactivated via admin panel' },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function liveDashboard(req, res, next) {
  try {
    const timeService = require('../services/timeService');
    const employees = await prisma.employee.findMany({ where: { active: true } });

    const results = await Promise.all(employees.map(async (emp) => {
      const { state } = await timeService.getCurrentState(emp.id);
      const workedSeconds = await timeService.getWorkedSecondsToday(emp.id);
      return { id: emp.id, name: emp.name, avatarUrl: emp.avatarUrl, state, workedSeconds };
    }));

    res.json({ employees: results });
  } catch (err) { next(err); }
}

async function getSettings(req, res, next) {
  try {
    const settings = await prisma.globalSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    res.json({ settings });
  } catch (err) { next(err); }
}

async function updateSettings(req, res, next) {
  try {
    const { defaultDutyStartTime, dailyTargetHours, autoCheckoutBufferHours, lunchMaxMinutes } = req.body;
    const data = {};
    if (defaultDutyStartTime !== undefined) data.defaultDutyStartTime = defaultDutyStartTime;
    if (dailyTargetHours !== undefined) data.dailyTargetHours = parseFloat(dailyTargetHours);
    if (autoCheckoutBufferHours !== undefined) data.autoCheckoutBufferHours = parseFloat(autoCheckoutBufferHours);
    if (lunchMaxMinutes !== undefined) data.lunchMaxMinutes = parseInt(lunchMaxMinutes, 10);

    const settings = await prisma.globalSettings.upsert({
      where: { id: 1 }, update: data, create: Object.assign({ id: 1 }, data),
    });
    res.json({ settings });
  } catch (err) { next(err); }
}

// GET /api/admin/audit — full admin-action history, newest first
async function listAuditLog(req, res, next) {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { admin: { select: { name: true } }, employee: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json({ logs });
  } catch (err) { next(err); }
}

// GET /api/admin/admins — list all admin accounts (excluding password)
async function listAdmins(req, res, next) {
  try {
    const admins = await prisma.admin.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, active: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
    res.json({ admins });
  } catch (err) { next(err); }
}

module.exports = {
  createAdmin, createEmployee, listEmployees, getEmployee, updateEmployee,
  resetPassword, deactivateEmployee, reactivateEmployee, liveDashboard,
  getSettings, updateSettings, listAuditLog, listAdmins,
};
async function deactivateAdmin(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }
    const target = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Admin not found' });
    if (target.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'The master admin account cannot be deactivated' });
    }
    await prisma.admin.update({ where: { id: req.params.id }, data: { active: false } });
    await prisma.session.deleteMany({ where: { adminId: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function reactivateAdmin(req, res, next) {
  try {
    await prisma.admin.update({ where: { id: req.params.id }, data: { active: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function resetAdminPassword(req, res, next) {
  try {
    const newPassword = req.body.newPassword;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({ where: { id: req.params.id }, data: { password: hash } });
    await prisma.session.deleteMany({ where: { adminId: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports.deactivateAdmin = deactivateAdmin;
module.exports.reactivateAdmin = reactivateAdmin;
module.exports.resetAdminPassword = resetAdminPassword;

async function deactivateAdmin(req, res, next) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't deactivate your own account" });
    }
    const target = await prisma.admin.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: 'Admin not found' });
    if (target.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'The master admin account cannot be deactivated' });
    }
    await prisma.admin.update({ where: { id: req.params.id }, data: { active: false } });
    await prisma.session.deleteMany({ where: { adminId: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function reactivateAdmin(req, res, next) {
  try {
    await prisma.admin.update({ where: { id: req.params.id }, data: { active: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function resetAdminPassword(req, res, next) {
  try {
    const newPassword = req.body.newPassword;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.admin.update({ where: { id: req.params.id }, data: { password: hash } });
    await prisma.session.deleteMany({ where: { adminId: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports.deactivateAdmin = deactivateAdmin;
module.exports.reactivateAdmin = reactivateAdmin;
module.exports.resetAdminPassword = resetAdminPassword;
