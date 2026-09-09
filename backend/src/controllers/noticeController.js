const prisma = require('../config/db');

// POST /api/notices   Body: { title, body, durationHours }  (Spec §7.5, §8.4)
async function publishNotice(req, res, next) {
  try {
    const { title, body, durationHours } = req.body;
    if (!title || !body || !durationHours) {
      return res.status(400).json({ error: 'title, body, and durationHours are required' });
    }

    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt.getTime() + durationHours * 3600000);

    const notice = await prisma.notice.create({
      data: { title, body, createdBy: req.user.id, publishedAt, expiresAt },
    });

    // BACKEND NOTE: trigger pushService.sendToAllEmployees() here once
    // pushService is implemented (Spec §6.3).

    res.json({ notice });
  } catch (err) { next(err); }
}

// GET /api/notices/active — only currently-visible notices (not expired, not revoked)
async function activeNotices(req, res, next) {
  try {
    const notices = await prisma.notice.findMany({
      where: { revoked: false, expiresAt: { gt: new Date() } },
      orderBy: { publishedAt: 'desc' },
    });
    res.json({ notices });
  } catch (err) { next(err); }
}

// GET /api/notices — all notices (admin view, for managing/revoking)
async function listAllNotices(req, res, next) {
  try {
    const notices = await prisma.notice.findMany({ orderBy: { publishedAt: 'desc' } });
    res.json({ notices });
  } catch (err) { next(err); }
}

// POST /api/notices/:id/revoke
async function revokeNotice(req, res, next) {
  try {
    await prisma.notice.update({ where: { id: req.params.id }, data: { revoked: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

module.exports = { publishNotice, activeNotices, listAllNotices, revokeNotice };