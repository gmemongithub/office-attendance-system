const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middleware/authMiddleware');
const employeeOnly = require('../middleware/employeeOnly');

router.use(authMiddleware, employeeOnly);

router.get('/today', attendanceController.today);
router.post('/check-in', attendanceController.checkIn);
router.post('/break/start', attendanceController.startBreak);
router.post('/break/end', attendanceController.endBreak);
router.post('/check-out', attendanceController.checkOut);

module.exports = router;