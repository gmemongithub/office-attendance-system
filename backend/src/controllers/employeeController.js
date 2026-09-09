const prisma = require('../config/db');

// POST /api/employee/push-subscribe   Body: { endpoint, keys: { p256dh, auth } }
// Called by the frontend after the browser grants Notification permission
// and subscribes via the Push API (Spec §6).
async function subscribePush(req, res, next) {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ error: 'endpoint and keys.p256dh/keys.auth are required' });
    }

    await prisma.pushSubscription.upsert({
      where: { employeeId: req.user.id },
      update: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
      create: { employeeId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/employee/me — own profile (duty time, etc.)
async function myProfile(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, avatarUrl: true, dutyStartTimeOverride: true },
    });
    res.json({ employee });
  } catch (err) { next(err); }
}

module.exports = { subscribePush, myProfile };