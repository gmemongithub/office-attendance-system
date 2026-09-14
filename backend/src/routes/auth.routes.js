const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);
router.patch('/me/email', authMiddleware, authController.updateEmail);
router.patch('/me/name', authMiddleware, authController.updateName);

module.exports = router;