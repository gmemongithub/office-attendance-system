const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const adminRoutes = require('./routes/admin.routes');
const employeeRoutes = require('./routes/employee.routes');
const holidayRoutes = require('./routes/holiday.routes');
const noticeRoutes = require('./routes/notice.routes');
const reportRoutes = require('./routes/report.routes');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/reports', reportRoutes);

// Centralized error handler — every controller should call next(err)
// on unexpected failures rather than sending its own 500.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

module.exports = app;