/* eslint-disable no-console */
import {
  AttendanceStatus,
  PaymentStatus,
  PrismaClient,
  Role,
  TopicStatus,
  Weekday,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@eos.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!change';

async function main() {
  console.log('Seeding EOS database…');

  // ── Super admin ──
  const adminHash = await argon2.hash(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL.toLowerCase() },
    update: {},
    create: { email: ADMIN_EMAIL.toLowerCase(), passwordHash: adminHash, role: Role.SUPER_ADMIN },
  });
  console.log(`  ✓ super admin: ${admin.email} / ${ADMIN_PASSWORD}`);

  // ── Branch ──
  const branch = await prisma.branch.create({
    data: { name: 'Main Campus', address: '123 Academy St', phone: '+1000000000' },
  });

  // ── Programs & subjects ──
  const sat = await prisma.program.create({ data: { name: 'SAT', code: 'SAT' } });
  const ap = await prisma.program.create({ data: { name: 'AP', code: 'AP' } });

  const satMath = await prisma.subject.create({
    data: { name: 'SAT Math', programId: sat.id },
  });
  const apPhysics = await prisma.subject.create({
    data: { name: 'AP Physics', programId: ap.id },
  });

  // ── Curriculum topics for SAT Math ──
  const satTopics = ['Algebra', 'Functions', 'Geometry', 'Statistics', 'Probability'];
  const topicRecords = await Promise.all(
    satTopics.map((name, i) =>
      prisma.curriculumTopic.create({
        data: { subjectId: satMath.id, name, orderIndex: i },
      }),
    ),
  );

  // ── Teachers ──
  const teacherHash = await argon2.hash('Teacher123!');
  const teacherA = await prisma.teacher.create({
    data: {
      firstName: 'Aysel',
      lastName: 'Mammadova',
      phone: '+994500000001',
      subjectsTaught: ['SAT Math'],
      employmentDate: new Date('2024-09-01'),
      user: { create: { email: 'aysel@eos.local', passwordHash: teacherHash, role: Role.TEACHER } },
    },
  });
  const teacherB = await prisma.teacher.create({
    data: {
      firstName: 'Rashad',
      lastName: 'Aliyev',
      phone: '+994500000002',
      subjectsTaught: ['AP Physics'],
      employmentDate: new Date('2023-09-01'),
      user: { create: { email: 'rashad@eos.local', passwordHash: teacherHash, role: Role.TEACHER } },
    },
  });
  console.log('  ✓ teachers: aysel@eos.local, rashad@eos.local / Teacher123!');

  // ── Students ──
  const firstNames = ['Ali', 'Nigar', 'Kamran', 'Leyla', 'Tural', 'Sevda', 'Murad', 'Aytac', 'Elvin', 'Gunel', 'Orxan', 'Nargiz'];
  const lastNames = ['Hasanov', 'Quliyeva', 'Ismayilov', 'Abbasova', 'Huseynov', 'Karimova'];
  const students = [];
  for (let i = 0; i < firstNames.length; i++) {
    const s = await prisma.student.create({
      data: {
        firstName: firstNames[i],
        lastName: lastNames[i % lastNames.length],
        phone: `+99455000${1000 + i}`,
        branchId: branch.id,
        enrollmentDate: new Date('2025-09-01'),
      },
    });
    students.push(s);
  }
  console.log(`  ✓ ${students.length} students`);

  // ── Groups ──
  const groupMath = await prisma.group.create({
    data: {
      name: 'SAT Math A',
      subjectId: satMath.id,
      teacherId: teacherA.id,
      branchId: branch.id,
      monthlyFee: 150,
      schedules: {
        create: [
          { weekday: Weekday.MON, startTime: '16:00', endTime: '17:30' },
          { weekday: Weekday.WED, startTime: '16:00', endTime: '17:30' },
        ],
      },
    },
  });
  const groupPhysics = await prisma.group.create({
    data: {
      name: 'AP Physics A',
      subjectId: apPhysics.id,
      teacherId: teacherB.id,
      branchId: branch.id,
      monthlyFee: 180,
      schedules: {
        create: [{ weekday: Weekday.TUE, startTime: '18:00', endTime: '19:30' }],
      },
    },
  });

  // Enroll: first 8 into Math, last 6 into Physics (overlap in the middle).
  const mathStudents = students.slice(0, 8);
  const physicsStudents = students.slice(6);
  await prisma.groupStudent.createMany({
    data: mathStudents.map((s) => ({ groupId: groupMath.id, studentId: s.id })),
  });
  await prisma.groupStudent.createMany({
    data: physicsStudents.map((s) => ({ groupId: groupPhysics.id, studentId: s.id })),
  });

  // ── Curriculum progress (first 3 topics complete) ──
  for (let i = 0; i < topicRecords.length; i++) {
    await prisma.curriculumProgress.create({
      data: {
        groupId: groupMath.id,
        topicId: topicRecords[i].id,
        status: i < 3 ? TopicStatus.COMPLETED : TopicStatus.NOT_STARTED,
        completedAt: i < 3 ? new Date() : null,
      },
    });
  }

  // ── Lessons + attendance (last 6 Mondays/Wednesdays-ish) ──
  const today = new Date();
  for (let week = 6; week >= 1; week--) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - week * 3);
    date.setUTCHours(0, 0, 0, 0);

    const lesson = await prisma.lesson.create({
      data: { groupId: groupMath.id, date, topic: `Lesson week -${week}` },
    });
    for (let si = 0; si < mathStudents.length; si++) {
      // Make student #0 a low-attendance / at-risk case.
      let status: AttendanceStatus = AttendanceStatus.PRESENT;
      if (si === 0) status = week % 2 === 0 ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT;
      else if (si === 1 && week === 1) status = AttendanceStatus.LATE;
      await prisma.attendance.create({
        data: {
          lessonId: lesson.id,
          studentId: mathStudents[si].id,
          status,
          markedById: teacherA.userId,
        },
      });
    }
  }

  // ── Payments for current month ──
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  for (let si = 0; si < mathStudents.length; si++) {
    const overdue = si === 0; // student #0 also has an overdue payment
    const dueDate = new Date(Date.UTC(y, m - 1, 5));
    if (overdue) dueDate.setUTCDate(dueDate.getUTCDate() - 40);
    await prisma.payment.create({
      data: {
        studentId: mathStudents[si].id,
        groupId: groupMath.id,
        periodYear: y,
        periodMonth: m,
        amountDue: 150,
        amountPaid: si % 3 === 0 ? 0 : 150,
        dueDate,
        status: si % 3 === 0 ? (overdue ? PaymentStatus.OVERDUE : PaymentStatus.PENDING) : PaymentStatus.PAID,
        paidAt: si % 3 === 0 ? null : new Date(),
      },
    });
  }

  // ── Exams + results (two exams to create a trend / drop) ──
  const exam1 = await prisma.exam.create({
    data: { name: 'Diagnostic', subjectId: satMath.id, groupId: groupMath.id, date: new Date('2026-04-10'), maxScore: 100 },
  });
  const exam2 = await prisma.exam.create({
    data: { name: 'Midterm', subjectId: satMath.id, groupId: groupMath.id, date: new Date('2026-05-20'), maxScore: 100 },
  });
  for (let si = 0; si < mathStudents.length; si++) {
    await prisma.examResult.create({
      data: { examId: exam1.id, studentId: mathStudents[si].id, score: 70 + (si % 5) * 5 },
    });
    // Student #0 drops sharply; others stable/improving.
    const second = si === 0 ? 45 : 72 + (si % 5) * 5;
    await prisma.examResult.create({
      data: { examId: exam2.id, studentId: mathStudents[si].id, score: second },
    });
  }

  // ── A couple of academic notes ──
  await prisma.teacherNote.create({
    data: {
      studentId: mathStudents[1].id,
      teacherId: teacherA.id,
      authorId: teacherA.userId,
      groupId: groupMath.id,
      type: 'STRENGTH',
      content: 'Strong in Algebra; quick with linear equations.',
    },
  });
  await prisma.teacherNote.create({
    data: {
      studentId: mathStudents[0].id,
      teacherId: teacherA.id,
      authorId: teacherA.userId,
      groupId: groupMath.id,
      type: 'WEAKNESS',
      content: 'Needs improvement in Geometry; missing many lessons recently.',
    },
  });

  console.log('Seed complete. Run POST /api/v1/risk/recompute (as admin) to populate risk flags.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
