const prisma = require('../config/db');
const { nowBD } = require('../utils/dateUtils');

// Determines which "shift day" (workDate) the CURRENT MOMENT belongs to,
// for a specific employee, based on THEIR duty start time (override, or
// the global default). If the current time-of-day is before their duty
// start time, we're still within the shift that began the day before —
// this is what makes overnight shifts (e.g. 7 PM-3 AM) work correctly,
// and also protects normal day-shift overtime from splitting at midnight.
// The reset boundary for a given calendar date `d` is 8 hours BEFORE
// that date's duty start time. Because dutyMinutes-480 can be negative
// (duty times before 8 AM), this boundary can land on the previous
// calendar date's clock -- Date's own overflow/underflow arithmetic
// handles that correctly here.
function boundaryAbsoluteTime(dutyMinutes, calendarDate) {
  const offset = dutyMinutes - 480;
  return new Date(Date.UTC(
    calendarDate.getUTCFullYear(), calendarDate.getUTCMonth(), calendarDate.getUTCDate(),
    0, offset, 0
  ));
}

async function getShiftWorkDate(employeeId) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  const settings = await prisma.globalSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const dutyTime = (employee && employee.dutyStartTimeOverride) || settings.defaultDutyStartTime || '09:30';
  const [h, m] = dutyTime.split(':').map(Number);
  const dutyMinutes = h * 60 + m;

  const now = nowBD();
  const d0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Find which daily window [boundary(d), boundary(d+1)) contains "now".
  // This correctly handles both directions: an overnight shift stays on
  // its start date past midnight, AND an early check-in (well before a
  // late-morning duty time) still counts as the current calendar date,
  // rather than incorrectly rolling back to the previous date.
  const d0Boundary = boundaryAbsoluteTime(dutyMinutes, d0);
  let shiftDate;
  if (now < d0Boundary) {
    shiftDate = new Date(d0); shiftDate.setUTCDate(shiftDate.getUTCDate() - 1);
  } else {
    const d0Plus1 = new Date(d0); d0Plus1.setUTCDate(d0Plus1.getUTCDate() + 1);
    const d0Plus1Boundary = boundaryAbsoluteTime(dutyMinutes, d0Plus1);
    shiftDate = (now >= d0Plus1Boundary) ? d0Plus1 : d0;
  }
  return shiftDate;
}

async function getCurrentState(employeeId) {
  const workDate = await getShiftWorkDate(employeeId);

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
  const workDate = await getShiftWorkDate(employeeId);
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
  const workDate = await getShiftWorkDate(employeeId);
  const lunch = await prisma.attendanceEvent.findFirst({
    where: { employeeId, workDate, type: 'BREAK_START', breakReason: 'LUNCH' },
  });
  return !!lunch;
}

// Sums ONLY closed work intervals (CHECK_IN/BREAK_END -> BREAK_START/CHECK_OUT),
// deliberately excluding the currently-open running session. Used by
// autoCheckoutJob so the remaining-hours calculation reflects hours
// worked BEFORE this session started, not a moving target that grows
// as the session itself runs (which was causing auto-checkout to fire
// at half the intended time).
async function getPriorWorkedSecondsToday(employeeId) {
  const workDate = await getShiftWorkDate(employeeId);
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
  // No trailing addition for an open interval — that's the current session, excluded on purpose.
  return Math.floor(workedMs / 1000);
}

module.exports = { getCurrentState, getWorkedSecondsToday, getPriorWorkedSecondsToday, hasUsedLunchToday, getShiftWorkDate };
