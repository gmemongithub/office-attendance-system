const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/authMiddleware');
const employeeOnly = require('../middleware/employeeOnly');

router.use(authMiddleware, employeeOnly);

router.get('/me', employeeController.myProfile);
router.post('/push-subscribe', employeeController.subscribePush);

module.exports = router;