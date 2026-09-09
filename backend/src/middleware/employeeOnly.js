function employeeOnly(req, res, next) {
  if (!req.user || req.user.type !== 'EMPLOYEE') {
    return res.status(403).json({ error: 'This action is only available to employee accounts' });
  }
  next();
}

module.exports = employeeOnly;