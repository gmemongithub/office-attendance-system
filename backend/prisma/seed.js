const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@company.com' },
    update: {},
    create: {
      name: 'Emon Hasan',
      email: 'admin@company.com',
      password: adminPasswordHash,
    },
  });

  const empPasswordHash = await bcrypt.hash('emp123', 10);
  const employee = await prisma.employee.upsert({
    where: { email: 'sarah@company.com' },
    update: {},
    create: {
      name: 'Sarah Ali',
      email: 'sarah@company.com',
      password: empPasswordHash,
    },
  });

  await prisma.globalSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  console.log('Seeded admin:', admin.email, '(password: admin123)');
  console.log('Seeded employee:', employee.email, '(password: emp123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());