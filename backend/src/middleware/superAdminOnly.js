const prisma = require('../config/db');

async function superAdminOnly(req, res, next) {
  if (req.user.type !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
  if (!admin || admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Only the master admin can manage other admin accounts' });
  }
  next();
}

module.exports = superAdminOnly;
