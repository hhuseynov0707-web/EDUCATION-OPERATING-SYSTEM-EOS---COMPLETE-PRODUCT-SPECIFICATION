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
        where: {
          deletedAt: null,
          OR: [{ student: { deletedAt: null } }, { studentId: null }],
          periodYear: now.getUTCFullYear(),
          periodMonth: now.getUTCMonth() + 1,
        },
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

  /** Academy-wide monthly business metrics for the last N months (admin). */
  async monthly(monthsBack = 6) {
    const window = lastNMonths(monthsBack);
    const orPeriods = window.map((w) => ({ periodYear: w.year, periodMonth: w.month }));
    const rangeStart = new Date(Date.UTC(window[0].year, window[0].month - 1, 1));

    const [payments, salaries, lessons] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          deletedAt: null,
          OR: [{ student: { deletedAt: null } }, { studentId: null }],
          AND: [{ OR: orPeriods }],
        },
        select: {
          periodYear: true, periodMonth: true,
          amountDue: true, discount: true, amountPaid: true, studentId: true,
        },
      }),
      this.prisma.salaryPayment.findMany({
        where: { OR: orPeriods },
        select: { periodYear: true, periodMonth: true, amount: true },
      }),
      this.prisma.lesson.findMany({
        where: { deletedAt: null, date: { gte: rangeStart } },
        select: { date: true, attendance: { select: { status: true } } },
      }),
    ]);

    type Bucket = {
      year: number; month: number;
      expected: number; collected: number; salaries: number;
      students: Set<string>; attendTotal: number; attendPresent: number;
    };
    const buckets = new Map<string, Bucket>();
    for (const w of window) {
      buckets.set(`${w.year}-${w.month}`, {
        year: w.year, month: w.month,
        expected: 0, collected: 0, salaries: 0,
        students: new Set(), attendTotal: 0, attendPresent: 0,
      });
    }

    for (const p of payments) {
      const b = buckets.get(`${p.periodYear}-${p.periodMonth}`);
      if (!b) continue;
      b.expected += Number(p.amountDue) - Number(p.discount);
      b.collected += Number(p.amountPaid);
      if (p.studentId) b.students.add(p.studentId);
    }
    for (const s of salaries) {
      const b = buckets.get(`${s.periodYear}-${s.periodMonth}`);
      if (b) b.salaries += Number(s.amount);
    }
    for (const l of lessons) {
      const b = buckets.get(`${l.date.getUTCFullYear()}-${l.date.getUTCMonth() + 1}`);
      if (!b) continue;
      for (const a of l.attendance) {
        b.attendTotal += 1;
        if (a.status === AttendanceStatus.PRESENT || a.status === AttendanceStatus.LATE) {
          b.attendPresent += 1;
        }
      }
    }

    return window.map((w) => {
      const b = buckets.get(`${w.year}-${w.month}`)!;
      const collected = round2(b.collected);
      const salariesPaid = round2(b.salaries);
      return {
        year: w.year,
        month: w.month,
        label: `${MONTH_ABBR[w.month - 1]} ${w.year}`,
        expectedRevenue: round2(b.expected),
        collectedRevenue: collected,
        collectionRate: b.expected > 0 ? Math.round((b.collected / b.expected) * 100) : null,
        students: b.students.size,
        attendanceRate: b.attendTotal > 0 ? Math.round((b.attendPresent / b.attendTotal) * 100) : null,
        salariesPaid,
        netRevenue: round2(collected - salariesPaid),
      };
    });
  }
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The last `n` months as {year, month}, oldest first, including the current. */
function lastNMonths(n: number): { year: number; month: number }[] {
  const now = new Date();
  const out: { year: number; month: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
