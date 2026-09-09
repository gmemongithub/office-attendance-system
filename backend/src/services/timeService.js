const prisma = require('../config/db');
const { todayWorkDateBD, nowBD } = require('../utils/dateUtils');

async function getCurrentState(employeeId) {
  const workDate = todayWorkDateBD();

  const lastEvent = await prisma.attendanceEvent.findFirst({
    where: { employeeId, workDate },
    orderBy: { serverTimestamp: 'desc' },
  });

  if (!lastEvent) return { state: 'OUT', lastEvent: null };

  if (lastEvent.type === 'CHECK_IN' || lastEvent.type === 'BREAK_END') {
    return { state: 'IN_OFFICE', lastEvent };
  }
  if (lastEvent.type === 'BREAK_START') {
    return { state: lastEvent.breakReason === 'LUNCH' ? 'ON_LUNCH' : 'ON_OTHER_BREAK', lastEvent };
  }
  // CHECK_OUT already happened today — day is DONE, not "OUT" (resets only at midnight BD)
  return { state: 'DONE', lastEvent };
}

async function getWorkedSecondsToday(employeeId) {
  const workDate = todayWorkDateBD();
  const events = await prisma.attendanceEvent.findMany({
    where: { employeeId, workDate },
    orderBy: { serverTimestamp: 'asc' },
  });

  let workedMs = 0;
  let intervalStart = null;

  for (const ev of events) {
    if (ev.type === 'CHECK_IN' || ev.type === 'BREAK_END') {
      intervalStart = ev.serverTimestamp;
    } else if ((ev.type === 'BREAK_START' || ev.type === 'CHECK_OUT') && intervalStart) {
      workedMs += new Date(ev.serverTimestamp) - new Date(intervalStart);
      intervalStart = null;
    }
  }

  if (intervalStart) {
    workedMs += nowBD().getTime() - new Date(intervalStart).getTime();
  }

  return Math.floor(workedMs / 1000);
}

async function hasUsedLunchToday(employeeId) {
  const workDate = todayWorkDateBD();
  const lunch = await prisma.attendanceEvent.findFirst({
    where: { employeeId, workDate, type: 'BREAK_START', breakReason: 'LUNCH' },
  });
  return !!lunch;
}

module.exports = { getCurrentState, getWorkedSecondsToday, hasUsedLunchToday };
