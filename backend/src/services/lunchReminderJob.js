const cron = require('node-cron');
const prisma = require('../config/db');
const { nowBD } = require('../utils/dateUtils');
const timeService = require('./timeService');
const pushService = require('./pushService');

// Runs every minute — if an employee is on LUNCH past the configured max
// duration, send ONE reminder push (never repeats, never auto-resumes —
// Spec §5 explicitly says this is a reminder only, not a forced action).
async function checkLunchOverruns() {
  const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });
  const maxMs = (settings?.lunchMaxMinutes ?? 70) * 60000;

  const employees = await prisma.employee.findMany({ where: { active: true } });

  for (const emp of employees) {
    const { state, lastEvent } = await timeService.getCurrentState(emp.id);
    if (state !== 'ON_LUNCH') continue;

    const elapsedMs = nowBD().getTime() - new Date(lastEvent.serverTimestamp).getTime();
    if (elapsedMs <= maxMs) continue;

    // Send only once per overrun: check whether we've already flagged
    // this exact BREAK_START event as overrun (reuse isLunchOverrun as
    // the "already notified" marker for the ongoing break).
    if (lastEvent.isLunchOverrun) continue;

    await prisma.attendanceEvent.update({
      where: { id: lastEvent.id },
      data: { isLunchOverrun: true },
    });

    await pushService.sendToEmployee(emp.id, {
      title: 'Still on lunch?',
      body: "Your lunch break has run past the usual time — tap 'Back into Office' when you're back.",
    });
    console.log(`[lunchReminderJob] sent overrun reminder to ${emp.name}`);
  }
}

function start() {
  cron.schedule('* * * * *', () => {
    checkLunchOverruns().catch(err => console.error('[lunchReminderJob] error:', err));
  });
  console.log('[lunchReminderJob] scheduled (every minute)');
}

module.exports = { start };