const express = require('express');
const router = express.Router();
const avatarController = require('../controllers/avatarController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

router.post('/', authMiddleware, upload.single('avatar'), avatarController.uploadAvatar);

module.exports = router;
