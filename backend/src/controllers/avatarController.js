const prisma = require('../config/db');

// POST /api/avatar — works for both EMPLOYEE and ADMIN. Saves the file's
// public path (served statically under /api/uploads) on the correct
// table depending on who's logged in.
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = '/api/uploads/' + req.file.filename;

    if (req.user.type === 'EMPLOYEE') {
      await prisma.employee.update({ where: { id: req.user.id }, data: { avatarUrl } });
    } else {
      await prisma.admin.update({ where: { id: req.user.id }, data: { avatarUrl } });
    }

    res.json({ avatarUrl });
  } catch (err) { next(err); }
}

module.exports = { uploadAvatar };
