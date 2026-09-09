const prisma = require('../config/db');
const holidayController = require('./holidayController');
const { nowBD } = require('../utils/dateUtils');

async function listMonths(req, res, next) {
  try {
    const employeeId = req.params.id;
    const events = await prisma.attendanceEvent.findMany({
      where: { employeeId }, select: { workDate: true }, distinct: ['workDate'],
    });
    const monthSet = new Set();
    events.forEach(e => {
      const d = new Date(e.workDate);
      monthSet.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    });
    const months = Array.from(monthSet).sort().reverse().map(key => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, label: new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
    });
    res.json({ months });
  } catch (err) { next(err); }
}

async function listAllMonths(req, res, next) {
  try {
    const events = await prisma.attendanceEvent.findMany({
      select: { workDate: true }, distinct: ['workDate'],
    });
    const monthSet = new Set();
    events.forEach(e => {
      const d = new Date(e.workDate);
      monthSet.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    });
    const months = Array.from(monthSet).sort().reverse().map(key => {
      const [year, month] = key.split('-').map(Number);
      return { year, month, label: new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
    });
    res.json({ months });
  } catch (err) { next(err); }
}

async function listDays(req, res, next) {
  try {
    const employeeId = req.params.id;
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);

    const today = nowBD();
    const isCurrentMonth = (year === today.getFullYear() && month === today.getMonth() + 1);
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const daysInMonth = isCurrentMonth ? today.getDate() : lastDayOfMonth;

    const results = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const workDate = new Date(Date.UTC(year, month - 1, d));
      const isHol = await holidayController.isHoliday(workDate);
      const events = await prisma.attendanceEvent.findMany({ where: { employeeId, workDate }, orderBy: { serverTimestamp: 'asc' } });

      if (isHol) { results.push({ day: d, isHoliday: true, hasData: events.length > 0, flags: [] }); continue; }
      if (events.length === 0) { results.push({ day: d, isHoliday: false, hasData: false, flags: [] }); continue; }

      const flags = [];
      if (events.some(e => e.isForgotFlag)) flags.push('Forgot to check out');
      if (events.some(e => e.isLunchOverrun)) flags.push('Lunch overrun');
      results.push({ day: d, isHoliday: false, hasData: true, workedSeconds: sumWorkedSeconds(events), flags });
    }
    res.json({ year, month, days: results });
  } catch (err) { next(err); }
}

async function dayDetail(req, res, next) {
  try {
    const employeeId = req.params.id;
    const { year, month, day } = req.params;
    const workDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));

    const events = await prisma.attendanceEvent.findMany({ where: { employeeId, workDate }, orderBy: { serverTimestamp: 'asc' } });
    const isHol = await holidayController.isHoliday(workDate);
    const workedSeconds = sumWorkedSeconds(events);

    const eventIds = events.map(e => e.id);
    const auditLogs = eventIds.length
      ? await prisma.auditLog.findMany({
          where: { attendanceEventId: { in: eventIds } },
          include: { admin: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    res.json({ workDate, isHoliday: isHol, workedSeconds, events, auditLogs });
  } catch (err) { next(err); }
}

async function dateSummary(req, res, next) {
  try {
    const { year, month, day } = req.params;
    const workDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    const isHol = await holidayController.isHoliday(workDate);

    const employees = await prisma.employee.findMany({ where: { active: true } });
    const results = [];
    for (const emp of employees) {
      const events = await prisma.attendanceEvent.findMany({ where: { employeeId: emp.id, workDate }, orderBy: { serverTimestamp: 'asc' } });
      const flags = [];
      if (events.some(e => e.isForgotFlag)) flags.push('Forgot to check out');
      if (events.some(e => e.isLunchOverrun)) flags.push('Lunch overrun');
      results.push({ employeeId: emp.id, name: emp.name, hasData: events.length > 0, workedSeconds: sumWorkedSeconds(events), flags });
    }
    res.json({ year: parseInt(year), month: parseInt(month), day: parseInt(day), isHoliday: isHol, employees: results });
  } catch (err) { next(err); }
}

async function editEvent(req, res, next) {
  try {
    const { newTimestamp, reason } = req.body;
    if (!newTimestamp || !reason || !reason.trim()) {
      return res.status(400).json({ error: 'newTimestamp and a reason note are both required' });
    }
    const event = await prisma.attendanceEvent.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const before = { serverTimestamp: event.serverTimestamp, isForgotFlag: event.isForgotFlag };
    const updated = await prisma.attendanceEvent.update({
      where: { id: req.params.id },
      data: { serverTimestamp: new Date(newTimestamp), isForgotFlag: false },
    });

    await prisma.auditLog.create({
      data: {
        adminId: req.user.id, employeeId: event.employeeId, attendanceEventId: event.id,
        action: 'EDIT_EVENT_TIME',
        beforeValue: JSON.stringify(before),
        afterValue: JSON.stringify({ serverTimestamp: updated.serverTimestamp, isForgotFlag: false }),
        reason: reason.trim(),
      },
    });
    res.json({ event: updated });
  } catch (err) { next(err); }
}

function sumWorkedSeconds(events) {
  let workedMs = 0, intervalStart = null;
  for (const ev of events) {
    if (ev.type === 'CHECK_IN' || ev.type === 'BREAK_END') intervalStart = ev.serverTimestamp;
    else if ((ev.type === 'BREAK_START' || ev.type === 'CHECK_OUT') && intervalStart) {
      workedMs += new Date(ev.serverTimestamp) - new Date(intervalStart);
      intervalStart = null;
    }
  }
  return Math.floor(workedMs / 1000);
}

module.exports = { listMonths, listAllMonths, listDays, dayDetail, dateSummary, editEvent };