import { Injectable } from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /** The owner's single-glance overview. */
  async admin() {
    const now = new Date();
    const today = startOfToday();

    const [
      totalStudents,
      activeStudents,
      activeTeachers,
      todayAttendance,
      revenue,
      riskByLevel,
      recentActivity,
    // Promise.all (not $transaction) so Prisma keeps groupBy's precise typing.
    ] = await Promise.all([
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.student.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      this.prisma.teacher.count({ where: { deletedAt: null, user: { isActive: true } } }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { lesson: { date: today } },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { deletedAt: null, periodYear: now.getUTCFullYear(), periodMonth: now.getUTCMonth() + 1 },
        select: { amountDue: true, discount: true, amountPaid: true, status: true },
      }),
      this.prisma.riskFlag.groupBy({
        by: ['level'],
        where: { isCurrent: true, score: { gt: 0 } },
        _count: { _all: true },
        orderBy: { level: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { actor: { select: { email: true, role: true } } },
      }),
    ]);

    // Today's attendance summary.
    let present = 0;
    let totalMarked = 0;
    for (const r of todayAttendance) {
      totalMarked += r._count._all;
      if (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE) {
        present += r._count._all;
      }
    }

    // Revenue rollup for the current month.
    let expected = 0;
    let collected = 0;
    let overdue = 0;
    for (const p of revenue) {
      const net = Number(p.amountDue) - Number(p.discount);
      expected += net;
      collected += Number(p.amountPaid);
      if (p.status === 'OVERDUE') overdue += net - Number(p.amountPaid);
    }

    const risk = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<string, number>;
    for (const r of riskByLevel) risk[r.level] = r._count._all;

    return {
      students: { total: totalStudents, active: activeStudents },
      teachers: { active: activeTeachers },
      attendanceToday: {
        marked: totalMarked,
        present,
        rate: totalMarked > 0 ? Math.round((present / totalMarked) * 100) : null,
      },
      revenue: {
        month: now.getUTCMonth() + 1,
        year: now.getUTCFullYear(),
        expected: round2(expected),
        collected: round2(collected),
        overdue: round2(overdue),
      },
      risk: { ...risk, total: risk.MEDIUM + risk.HIGH + risk.CRITICAL },
      recentActivity,
    };
  }

  /** A teacher's daily working view. */
  async teacher(user: AuthUser) {
    const teacherId = user.profileId;
    const todayWeekday = WEEKDAYS[new Date().getUTCDay()];

    const groups = await this.prisma.group.findMany({
      where: { teacherId: teacherId ?? undefined, deletedAt: null },
      include: {
        subject: { select: { name: true } },
        schedules: true,
        _count: { select: { enrollments: true } },
      },
    });

    const todayGroups = groups.filter((g) =>
      g.schedules.some((s) => s.weekday === todayWeekday),
    );

    const today = startOfToday();
    const markedToday = await this.prisma.lesson.findMany({
      where: { groupId: { in: todayGroups.map((g) => g.id) }, date: today },
      select: { groupId: true },
    });
    const markedSet = new Set(markedToday.map((l) => l.groupId));

    return {
      groupCount: groups.length,
      studentCount: groups.reduce((s, g) => s + g._count.enrollments, 0),
      todayLessons: todayGroups.map((g) => ({
        groupId: g.id,
        name: g.name,
        subject: g.subject.name,
        students: g._count.enrollments,
        schedule: g.schedules.filter((s) => s.weekday === todayWeekday),
        attendanceMarked: markedSet.has(g.id),
      })),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        subject: g.subject.name,
        students: g._count.enrollments,
      })),
    };
  }
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
