const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');
const superAdminOnly = require('../middleware/superAdminOnly');

router.use(authMiddleware, adminOnly);

router.get('/dashboard', adminController.liveDashboard);
router.post('/admins', adminController.createAdmin);
router.post('/employees', adminController.createEmployee);
router.get('/admins', adminController.listAdmins);
router.post('/admins/:id/deactivate', superAdminOnly, adminController.deactivateAdmin);
router.post('/admins/:id/reactivate', superAdminOnly, adminController.reactivateAdmin);
router.post('/admins/:id/reset-password', superAdminOnly, adminController.resetAdminPassword);
router.get('/employees', adminController.listEmployees);
router.get('/employees/:id', adminController.getEmployee);
router.patch('/employees/:id', adminController.updateEmployee);
router.post('/employees/:id/reset-password', adminController.resetPassword);
router.post('/employees/:id/deactivate', adminController.deactivateEmployee);
router.post('/employees/:id/reactivate', adminController.reactivateEmployee);
router.get('/settings', adminController.getSettings);
router.patch('/settings', adminController.updateSettings);
router.get('/audit', adminController.listAuditLog);
router.get('/audit', adminController.listAuditLog);

module.exports = router;