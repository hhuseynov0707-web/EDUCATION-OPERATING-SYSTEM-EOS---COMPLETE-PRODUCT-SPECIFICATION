import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Per-teacher salary status for a month, plus totals. */
  async overview(year: number, month: number) {
    const teachers = await this.prisma.teacher.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, salary: true },
    });
    const paid = await this.prisma.salaryPayment.findMany({
      where: { periodYear: year, periodMonth: month, teacherId: { in: teachers.map((t) => t.id) } },
    });
    const paidMap = new Map(paid.map((p) => [p.teacherId, p]));

    const rows = teachers.map((t) => {
      const rec = paidMap.get(t.id);
      return {
        teacherId: t.id,
        name: `${t.firstName} ${t.lastName}`,
        salary: t.salary != null ? Number(t.salary) : null,
        paid: !!rec,
        amount: rec ? Number(rec.amount) : null,
        paidAt: rec?.paidAt ?? null,
      };
    });

    const totalSalary = rows.reduce((s, r) => s + (r.salary ?? 0), 0);
    const totalPaid = rows.reduce((s, r) => s + (r.paid ? r.amount ?? 0 : 0), 0);
    const totalUnpaid = rows.reduce((s, r) => s + (!r.paid ? r.salary ?? 0 : 0), 0);

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

  /** Mark a teacher's salary paid for a month (defaults to their salary). */
  async pay(teacherId: string, year: number, month: number, amount?: number) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
      select: { salary: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    const amt = amount ?? (teacher.salary != null ? Number(teacher.salary) : 0);

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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
