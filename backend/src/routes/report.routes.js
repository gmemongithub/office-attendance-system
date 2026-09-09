const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware);

router.get('/months', adminOnly, reportController.listAllMonths);
router.get('/date/:year/:month/:day', adminOnly, reportController.dateSummary);

router.get('/employees/:id/months', adminOnly, reportController.listMonths);
router.get('/employees/:id/months/:year/:month', adminOnly, reportController.listDays);
router.get('/employees/:id/day/:year/:month/:day', adminOnly, reportController.dayDetail);
router.patch('/events/:id', adminOnly, reportController.editEvent);

router.get('/me/months', (req, res, next) => { req.params.id = req.user.id; reportController.listMonths(req, res, next); });
router.get('/me/months/:year/:month', (req, res, next) => { req.params.id = req.user.id; reportController.listDays(req, res, next); });
router.get('/me/day/:year/:month/:day', (req, res, next) => { req.params.id = req.user.id; reportController.dayDetail(req, res, next); });

module.exports = router;