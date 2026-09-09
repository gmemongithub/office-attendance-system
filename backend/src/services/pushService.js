const webpush = require('web-push');
const prisma = require('../config/db');
const { vapid } = require('../config/env');

webpush.setVapidDetails(vapid.contactEmail, vapid.publicKey, vapid.privateKey);

async function sendToEmployee(employeeId, payload) {
  const sub = await prisma.pushSubscription.findUnique({ where: { employeeId } });
  if (!sub) return; // employee hasn't granted push permission / subscribed yet

  const pushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dh, auth: sub.auth },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
  } catch (err) {
    // 410/404 = subscription is dead (browser unsubscribed, cleared data, etc.) — clean it up
    if (err.statusCode === 404 || err.statusCode === 410) {
      await prisma.pushSubscription.delete({ where: { employeeId } }).catch(() => {});
    } else {
      console.error(`[pushService] failed to send to ${employeeId}:`, err.message);
    }
  }
}

async function sendToAllActiveEmployees(payload) {
  const employees = await prisma.employee.findMany({ where: { active: true }, select: { id: true } });
  await Promise.all(employees.map(e => sendToEmployee(e.id, payload)));
}

module.exports = { sendToEmployee, sendToAllActiveEmployees };