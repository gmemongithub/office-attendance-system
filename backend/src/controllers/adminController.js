const bcrypt = require('bcrypt');
const prisma = require('../config/db');

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
    const employees = await prisma.employee.findMany({
      select: { id: true, name: true, email: true, active: true, avatarUrl: true, dutyStartTimeOverride: true, createdAt: true },
      orderBy: { name: 'asc' },
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
    res.json({ employee });
  } catch (err) { next(err); }
}

async function updateEmployee(req, res, next) {
  try {
    const { name, dutyStartTimeOverride } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (dutyStartTimeOverride !== undefined) data.dutyStartTimeOverride = dutyStartTimeOverride || null;

    const employee = await prisma.employee.update({ where: { id: req.params.id }, data });
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
    res.json({ ok: true });
  } catch (err) { next(err); }
}

async function reactivateEmployee(req, res, next) {
  try {
    await prisma.employee.update({ where: { id: req.params.id }, data: { active: true } });
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

module.exports = {
  createEmployee, listEmployees, getEmployee, updateEmployee,
  resetPassword, deactivateEmployee, reactivateEmployee, liveDashboard,
  getSettings, updateSettings,
};