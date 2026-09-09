// All "work date" boundaries are calculated in Bangladesh time (BD, UTC+6),
// per Spec §3 — the day resets at midnight BD time regardless of server
// machine timezone.

const BD_OFFSET_MINUTES = 6 * 60;

function nowBD() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + BD_OFFSET_MINUTES * 60000);
}

// Returns a Date representing midnight (00:00) BD time for "today",
// stored as a plain calendar date (used for AttendanceEvent.workDate).
function todayWorkDateBD() {
  const bd = nowBD();
  return new Date(Date.UTC(bd.getFullYear(), bd.getMonth(), bd.getDate()));
}

function startOfBDDay(date) {
  const bd = new Date(date);
  return new Date(Date.UTC(bd.getFullYear(), bd.getMonth(), bd.getDate()));
}

module.exports = { nowBD, todayWorkDateBD, startOfBDDay };