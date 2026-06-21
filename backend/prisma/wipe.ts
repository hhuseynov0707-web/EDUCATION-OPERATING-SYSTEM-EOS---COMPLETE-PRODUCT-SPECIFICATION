/* eslint-disable no-console */
// One-time clean-up: removes ALL domain data (demo + anything added) and keeps
// only the SUPER_ADMIN / ADMIN login(s). Use to start the academy fresh.
//   Run:  npm run db:wipe
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping all domain data (admin accounts are kept)…');

  // Delete in FK-safe order (children first).
  await prisma.attendance.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.examResult.deleteMany({});
  await prisma.exam.deleteMany({});
  await prisma.curriculumProgress.deleteMany({});
  await prisma.curriculumTopic.deleteMany({});
  await prisma.groupSchedule.deleteMany({});
  await prisma.groupStudent.deleteMany({});
  await prisma.riskFlag.deleteMany({});
  await prisma.teacherNote.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.salaryPayment.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.studentParent.deleteMany({});
  await prisma.group.deleteMany({});
  await prisma.student.deleteMany({});
  await prisma.parent.deleteMany({});
  await prisma.teacher.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.program.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.auditLog.deleteMany({});

  // Remove every non-admin login (teachers/parents/students); keep admins.
  const admins = { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } };
  await prisma.refreshToken.deleteMany({ where: { user: { is: { NOT: admins } } } });
  const deletedUsers = await prisma.user.deleteMany({ where: { NOT: admins } });

  const remaining = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log(`Removed ${deletedUsers.count} non-admin users.`);
  console.log('Kept admin accounts:', remaining.map((u) => `${u.email} (${u.role})`).join(', '));
  console.log('Done. The system is now clean — log in as admin and add real data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
