const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({ select: { employeeId: true } });
  const protectedEmployeeIds = admins.map(a => a.employeeId).filter(Boolean);

  console.log('Protected (admin-linked) employee IDs — record kept, but their data below is still cleared:', protectedEmployeeIds);

  // Clear ALL attendance/session/audit/push data, including the admins'
  // own linked-employee data — only the Admin/Employee ACCOUNT rows survive.
  const delEvents = await prisma.attendanceEvent.deleteMany({});
  const delSessions = await prisma.session.deleteMany({});
  const delAudit = await prisma.auditLog.deleteMany({});
  const delPush = await prisma.pushSubscription.deleteMany({});
  const delEmployees = await prisma.employee.deleteMany({
    where: { id: { notIn: protectedEmployeeIds } },
  });

  console.log('Deleted:', {
    attendanceEvents: delEvents.count,
    sessions: delSessions.count,
    auditLogs: delAudit.count,
    pushSubscriptions: delPush.count,
    employees: delEmployees.count,
  });
  console.log('NOTE: all sessions cleared -> everyone (including admins) will need to log in again.');
  console.log('Holidays and Notices were left untouched.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
