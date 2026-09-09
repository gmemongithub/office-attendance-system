const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');

router.use(authMiddleware, adminOnly);

router.get('/dashboard', adminController.liveDashboard);
router.post('/employees', adminController.createEmployee);
router.get('/employees', adminController.listEmployees);
router.get('/employees/:id', adminController.getEmployee);
router.patch('/employees/:id', adminController.updateEmployee);
router.post('/employees/:id/reset-password', adminController.resetPassword);
router.post('/employees/:id/deactivate', adminController.deactivateEmployee);
router.post('/employees/:id/reactivate', adminController.reactivateEmployee);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);

module.exports = router;