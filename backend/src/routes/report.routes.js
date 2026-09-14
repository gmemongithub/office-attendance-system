const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const { resolveAttendanceEmployeeId } = require('../services/identityService');

router.use(authMiddleware);

router.get('/subjects', adminOnly, reportController.listReportSubjects);
router.get('/months', adminOnly, reportController.listAllMonths);
router.get('/date/:year/:month/:day', adminOnly, reportController.dateSummary);

router.get('/employees/:id/months', adminOnly, reportController.listMonths);
router.get('/employees/:id/months/:year/:month', adminOnly, reportController.listDays);
router.get('/employees/:id/day/:year/:month/:day', adminOnly, reportController.dayDetail);
router.patch('/events/:id', adminOnly, reportController.editEvent);

router.get('/me/months', async (req, res, next) => { req.params.id = await resolveAttendanceEmployeeId(req); reportController.listMonths(req, res, next); });
router.get('/me/months/:year/:month', async (req, res, next) => { req.params.id = await resolveAttendanceEmployeeId(req); reportController.listDays(req, res, next); });
router.get('/me/day/:year/:month/:day', async (req, res, next) => { req.params.id = await resolveAttendanceEmployeeId(req); reportController.dayDetail(req, res, next); });

module.exports = router;