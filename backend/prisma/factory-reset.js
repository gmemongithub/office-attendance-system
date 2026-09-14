const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({ select: { employeeId: true } });
  const protectedEmployeeIds = admins.map(a => a.employeeId).filter(Boolean);

  const events = await prisma.attendanceEvent.deleteMany({});
  const sessions = await prisma.session.deleteMany({});
  const audit = await prisma.auditLog.deleteMany({});
  const push = await prisma.pushSubscription.deleteMany({});
  const notices = await prisma.notice.deleteMany({});
  const holidays = await prisma.holiday.deleteMany({});
  const employees = await prisma.employee.deleteMany({
    where: { id: { notIn: protectedEmployeeIds } },
  });

  // Clear avatar references for admins + their linked employees, and
  // delete the actual uploaded files from disk.
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (fs.existsSync(uploadDir)) {
    fs.readdirSync(uploadDir).forEach(f => fs.unlinkSync(path.join(uploadDir, f)));
  }
  await prisma.admin.updateMany({ data: { avatarUrl: null } });
  if (protectedEmployeeIds.length) {
    await prisma.employee.updateMany({ where: { id: { in: protectedEmployeeIds } }, data: { avatarUrl: null } });
  }

  console.log('Deleted:', {
    attendanceEvents: events.count, sessions: sessions.count, auditLogs: audit.count,
    pushSubscriptions: push.count, notices: notices.count, holidays: holidays.count,
    employees: employees.count,
  });
  console.log('Avatar files removed from disk, avatarUrl cleared for all remaining accounts.');
  console.log('Remaining: only Admin accounts + their linked employee record (attendance-empty).');
  console.log('Everyone (including admins) must log in again.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
