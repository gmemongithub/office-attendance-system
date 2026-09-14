// All "work date" boundaries are calculated in Bangladesh time (BD, UTC+6).
// This file deliberately NEVER uses getTimezoneOffset() or any local
// (non-UTC) Date getter (getHours, getFullYear, etc.) — those depend on
// the container/OS TZ setting, which is unreliable across environments
// and was the root cause of a real day-boundary bug in production.
// Instead: take the true UTC epoch, add BD's fixed +6h offset, and only
// ever read the result back with getUTC*() methods.

const BD_OFFSET_MS = 6 * 60 * 60 * 1000;

function nowBD() {
  return new Date(Date.now() + BD_OFFSET_MS);
}

function todayWorkDateBD() {
  const bd = nowBD();
  return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
}

function startOfBDDay(date) {
  const bd = new Date(date);
  return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()));
}

module.exports = { nowBD, todayWorkDateBD, startOfBDDay };
