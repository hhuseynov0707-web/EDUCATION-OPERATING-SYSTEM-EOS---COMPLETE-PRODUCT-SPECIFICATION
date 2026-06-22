import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// A teacher's groups with the data needed to compute their 50/50 share.
const groupShareSelect = {
  where: { deletedAt: null },
  select: {
    monthlyFee: true,
    enrollments: { where: { status: 'ACTIVE' as const }, select: { id: true } },
  },
} as const;

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-teacher salary status for a month, plus totals. */
  async overview(year: number, month: number) {
    const teachers = await this.prisma.teacher.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        salary: true,
        groups: groupShareSelect,
      },
    });
    const paid = await this.prisma.salaryPayment.findMany({
      where: { periodYear: year, periodMonth: month, teacherId: { in: teachers.map((t) => t.id) } },
    });
    const paidMap = new Map(paid.map((p) => [p.teacherId, p]));

    const rows = teachers.map((t) => {
      const rec = paidMap.get(t.id);
      // Default salary = the teacher's 50% share of their groups' fees.
      const expectedSalary = shareOf(t.groups);
      const studentCount = t.groups.reduce((n, g) => n + g.enrollments.length, 0);
      // A manually-set salary, if present, overrides the automatic split.
      const manualSalary = t.salary != null ? Number(t.salary) : null;
      const salary = manualSalary ?? expectedSalary;
      return {
        teacherId: t.id,
        name: `${t.firstName} ${t.lastName}`,
        salary,
        expectedSalary,
        manualSalary,
        studentCount,
        paid: !!rec,
        amount: rec ? Number(rec.amount) : null,
        paidAt: rec?.paidAt ?? null,
      };
    });

    const totalSalary = rows.reduce((s, r) => s + r.salary, 0);
    const totalPaid = rows.reduce((s, r) => s + (r.paid ? r.amount ?? 0 : 0), 0);
    const totalUnpaid = rows.reduce((s, r) => s + (!r.paid ? r.salary : 0), 0);

    return {
      period: { year, month },
      totals: {
        totalSalary: round2(totalSalary),
        totalPaid: round2(totalPaid),
        totalUnpaid: round2(totalUnpaid),
        paidCount: rows.filter((r) => r.paid).length,
        teacherCount: rows.length,
      },
      rows,
    };
  }

  /**
   * Mark a teacher's salary paid for a month. The amount defaults to their 50%
   * share of group fees (or a manually-set salary, if one is configured).
   */
  async pay(teacherId: string, year: number, month: number, amount?: number) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
      select: { salary: true, groups: groupShareSelect },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    const fallback = teacher.salary != null ? Number(teacher.salary) : shareOf(teacher.groups);
    const amt = amount ?? fallback;

    return this.prisma.salaryPayment.upsert({
      where: { teacherId_periodYear_periodMonth: { teacherId, periodYear: year, periodMonth: month } },
      create: { teacherId, periodYear: year, periodMonth: month, amount: new Prisma.Decimal(amt) },
      update: { amount: new Prisma.Decimal(amt), paidAt: new Date() },
    });
  }

  /** Remove a salary payment record (mark unpaid). */
  async unpay(teacherId: string, year: number, month: number) {
    await this.prisma.salaryPayment.deleteMany({
      where: { teacherId, periodYear: year, periodMonth: month },
    });
    return { success: true };
  }
}

/**
 * The teacher's automatic salary: 50% of what their groups bill, i.e.
 * Σ (active students in group × group monthly fee) ÷ 2 — a 50/50 split
 * between the academy and the teacher.
 */
function shareOf(groups: { monthlyFee: Prisma.Decimal; enrollments: unknown[] }[]): number {
  const gross = groups.reduce((s, g) => s + Number(g.monthlyFee) * g.enrollments.length, 0);
  return round2(gross / 2);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
