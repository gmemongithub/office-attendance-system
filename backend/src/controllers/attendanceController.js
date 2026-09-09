const prisma = require('../config/db');
const { todayWorkDateBD, nowBD } = require('../utils/dateUtils');
const timeService = require('../services/timeService');

async function checkIn(req, res, next) {
  try {
    const employeeId = req.user.id;
    const { state } = await timeService.getCurrentState(employeeId);
    if (state !== 'OUT') {
      return res.status(400).json({ error: state === 'DONE' ? 'You have already completed your day' : 'Already checked in or on a break' });
    }

    const event = await prisma.attendanceEvent.create({
      data: {
        employeeId,
        type: 'CHECK_IN',
        workDate: todayWorkDateBD(),
        serverTimestamp: nowBD(),
      },
    });
    res.json({ event });
  } catch (err) { next(err); }
}

async function startBreak(req, res, next) {
  try {
    const employeeId = req.user.id;
    const { reason, note } = req.body;

    if (!['LUNCH', 'OTHER'].includes(reason)) {
      return res.status(400).json({ error: 'reason must be LUNCH or OTHER' });
    }
    if (reason === 'OTHER' && (!note || !note.trim())) {
      return res.status(400).json({ error: 'A note is required for an Other-reason break' });
    }

    const { state } = await timeService.getCurrentState(employeeId);
    if (state !== 'IN_OFFICE') {
      return res.status(400).json({ error: 'You must be checked in to start a break' });
    }

    if (reason === 'LUNCH') {
      const used = await timeService.hasUsedLunchToday(employeeId);
      if (used) return res.status(400).json({ error: 'Lunch break already used today' });
    }

    const event = await prisma.attendanceEvent.create({
      data: {
        employeeId,
        type: 'BREAK_START',
        breakReason: reason,
        note: reason === 'OTHER' ? note.trim() : null,
        workDate: todayWorkDateBD(),
        serverTimestamp: nowBD(),
      },
    });
    res.json({ event });
  } catch (err) { next(err); }
}

async function endBreak(req, res, next) {
  try {
    const employeeId = req.user.id;
    const { state, lastEvent } = await timeService.getCurrentState(employeeId);
    if (state !== 'ON_LUNCH' && state !== 'ON_OTHER_BREAK') {
      return res.status(400).json({ error: 'You are not currently on a break' });
    }

    let isLunchOverrun = false;
    if (state === 'ON_LUNCH') {
      const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });
      const maxMs = (settings?.lunchMaxMinutes || 70) * 60000;
      const elapsedMs = nowBD().getTime() - new Date(lastEvent.serverTimestamp).getTime();
      isLunchOverrun = elapsedMs > maxMs;
    }

    const event = await prisma.attendanceEvent.create({
      data: {
        employeeId,
        type: 'BREAK_END',
        isLunchOverrun,
        workDate: todayWorkDateBD(),
        serverTimestamp: nowBD(),
      },
    });
    res.json({ event });
  } catch (err) { next(err); }
}

async function checkOut(req, res, next) {
  try {
    const employeeId = req.user.id;
    const { note } = req.body;
    const { state } = await timeService.getCurrentState(employeeId);
    if (state !== 'IN_OFFICE') {
      return res.status(400).json({ error: 'You must be checked in (not on a break) to check out' });
    }

    const event = await prisma.attendanceEvent.create({
      data: {
        employeeId,
        type: 'CHECK_OUT',
        note: note && note.trim() ? note.trim() : null,
        workDate: todayWorkDateBD(),
        serverTimestamp: nowBD(),
      },
    });
    res.json({ event });
  } catch (err) { next(err); }
}

async function today(req, res, next) {
  try {
    const employeeId = req.user.id;
    const { state } = await timeService.getCurrentState(employeeId);
    const workedSeconds = await timeService.getWorkedSecondsToday(employeeId);
    const events = await prisma.attendanceEvent.findMany({
      where: { employeeId, workDate: todayWorkDateBD() },
      orderBy: { serverTimestamp: 'asc' },
    });
    res.json({ state, workedSeconds, events });
  } catch (err) { next(err); }
}

module.exports = { checkIn, startBreak, endBreak, checkOut, today };
