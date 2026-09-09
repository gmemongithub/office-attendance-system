const cron = require('node-cron');
const prisma = require('../config/db');
const { nowBD, todayWorkDateBD } = require('../utils/dateUtils');
const timeService = require('./timeService');
const pushService = require('./pushService');
const holidayController = require('../controllers/holidayController');

// Runs every minute — at each employee's configured duty start time
// (individual override, or the global default), send a daily reminder
// IF they haven't checked in yet today. Sends at most once per day per
// employee (tracked via lastDutyReminderDate).
async function checkDutyReminders() {
  const today = todayWorkDateBD();
  if (await holidayController.isHoliday(today)) return; // no reminder on holidays

  const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });
  const globalDutyTime = settings?.defaultDutyStartTime ?? '09:30';

  const now = nowBD();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const employees = await prisma.employee.findMany({ where: { active: true } });

  for (const emp of employees) {
    const dutyTime = emp.dutyStartTimeOverride || globalDutyTime;
    if (dutyTime !== currentHHMM) continue;

    const alreadySentToday = emp.lastDutyReminderDate &&
      new Date(emp.lastDutyReminderDate).toDateString() === today.toDateString();
    if (alreadySentToday) continue;

    const { state } = await timeService.getCurrentState(emp.id);
    if (state !== 'OUT') continue; // already checked in — no reminder needed

    await pushService.sendToEmployee(emp.id, {
      title: 'Time to check in',
      body: "It's your duty start time — don't forget to check in for today.",
    });

    await prisma.employee.update({
      where: { id: emp.id },
      data: { lastDutyReminderDate: today },
    });
    console.log(`[dutyReminderJob] sent duty reminder to ${emp.name}`);
  }
}

function start() {
  cron.schedule('* * * * *', () => {
    checkDutyReminders().catch(err => console.error('[dutyReminderJob] error:', err));
  });
  console.log('[dutyReminderJob] scheduled (every minute)');
}

module.exports = { start };