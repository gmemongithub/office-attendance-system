const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/noticeController');
const authMiddleware = require('../middleware/authMiddleware');
const adminOnly = require('../middleware/adminOnly');

router.get('/active', authMiddleware, noticeController.activeNotices); // employees see this on their dashboard

router.post('/', authMiddleware, adminOnly, noticeController.publishNotice);
router.get('/', authMiddleware, adminOnly, noticeController.listAllNotices);
router.post('/:id/revoke', authMiddleware, adminOnly, noticeController.revokeNotice);

module.exports = router;