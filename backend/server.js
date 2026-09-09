const app = require('./src/app');
const { port } = require('./src/config/env');

const autoCheckoutJob = require('./src/services/autoCheckoutJob');
const lunchReminderJob = require('./src/services/lunchReminderJob');
const dutyReminderJob = require('./src/services/dutyReminderJob');

app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Cron jobs start alongside the server (Spec §4, §5, §6.1)
  autoCheckoutJob.start();
  lunchReminderJob.start();
  dutyReminderJob.start();
});