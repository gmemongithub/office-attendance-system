const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');

router.get('/', authMiddleware, holidayController.listHolidays); // both admin + employee can view

router.post('/weekly', authMiddleware, adminOnly, holidayController.addWeeklyHoliday);
router.delete('/weekly/:dayOfWeek', authMiddleware, adminOnly, holidayController.removeWeeklyHoliday);
router.post('/custom', authMiddleware, adminOnly, holidayController.addCustomHoliday);
router.delete('/custom/:id', authMiddleware, adminOnly, holidayController.removeCustomHoliday);

module.exports = router;