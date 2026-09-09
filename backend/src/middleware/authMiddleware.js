const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { jwtSecret } = require('../config/env');

// Verifies the JWT AND confirms the session row is still the active one
// for this user (Spec §8.1 — single-device enforcement). If an admin
// force-logged-out this session from another device, the Session row
// will be gone and this middleware rejects the request even though the
// JWT itself hasn't expired yet.
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const payload = jwt.verify(token, jwtSecret);

    const session = await prisma.session.findUnique({ where: { token: payload.jti } });
    if (!session) return res.status(401).json({ error: 'Session expired or logged out elsewhere' });

    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });

    req.user = { id: payload.sub, type: payload.type };
    req.sessionId = session.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;