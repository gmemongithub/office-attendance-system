const prisma = require('../config/db');

// POST /api/holidays/weekly   Body: { dayOfWeek: 0-6 }  (Spec §7.4)
async function addWeeklyHoliday(req, res, next) {
  try {
    const { dayOfWeek } = req.body;
    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: 'dayOfWeek must be 0 (Sun) to 6 (Sat)' });
    }
    const existing = await prisma.holiday.findFirst({ where: { type: 'WEEKLY', dayOfWeek } });
    if (existing) return res.json({ holiday: existing }); // idempotent

    const holiday = await prisma.holiday.create({ data: { type: 'WEEKLY', dayOfWeek } });
    res.json({ holiday });
  } catch (err) { next(err); }
}

// DELETE /api/holidays/weekly/:dayOfWeek
async function removeWeeklyHoliday(req, res, next) {
  try {
    await prisma.holiday.deleteMany({ where: { type: 'WEEKLY', dayOfWeek: parseInt(req.params.dayOfWeek, 10) } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/holidays/custom   Body: { title, startDate, endDate? }  (Spec §7.4 — single date or range)
async function addCustomHoliday(req, res, next) {
  try {
    const { title, startDate, endDate } = req.body;
    if (!title || !startDate) return res.status(400).json({ error: 'title and startDate are required' });

    const holiday = await prisma.holiday.create({
      data: {
        type: 'CUSTOM',
        title,
        startDate: new Date(startDate),
        endDate: new Date(endDate || startDate), // single-day: endDate defaults to same as startDate
      },
    });
    res.json({ holiday });
  } catch (err) { next(err); }
}

// DELETE /api/holidays/custom/:id
async function removeCustomHoliday(req, res, next) {
  try {
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/holidays — full list (weekly + custom), for admin settings screen
async function listHolidays(req, res, next) {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: { createdAt: 'asc' } });
    res.json({ holidays });
  } catch (err) { next(err); }
}

// Helper (used by reports later) — is this workDate a holiday?
async function isHoliday(date) {
  const dayOfWeek = date.getUTCDay();
  const weekly = await prisma.holiday.findFirst({ where: { type: 'WEEKLY', dayOfWeek } });
  if (weekly) return true;

  const custom = await prisma.holiday.findFirst({
    where: { type: 'CUSTOM', startDate: { lte: date }, endDate: { gte: date } },
  });
  return !!custom;
}

module.exports = { addWeeklyHoliday, removeWeeklyHoliday, addCustomHoliday, removeCustomHoliday, listHolidays, isHoliday };