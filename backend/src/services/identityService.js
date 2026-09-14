const prisma = require('../config/db');

// Resolves which Employee record's data a request should read/write.
// Employees use their own id directly; admins use their auto-created
// linked Employee record (an admin's own attendance is stored under
// that linked employee, not under the admin's own id).
async function resolveAttendanceEmployeeId(req) {
  if (req.user.type === 'EMPLOYEE') return req.user.id;
  let admin = await prisma.admin.findUnique({ where: { id: req.user.id } });
  if (!admin.employeeId) {
    const linkedEmployee = await prisma.employee.create({
      data: { name: admin.name, email: 'admin-' + admin.id + '@internal', password: admin.password },
    });
    admin = await prisma.admin.update({ where: { id: admin.id }, data: { employeeId: linkedEmployee.id } });
  }
  return admin.employeeId;
}

module.exports = { resolveAttendanceEmployeeId };
