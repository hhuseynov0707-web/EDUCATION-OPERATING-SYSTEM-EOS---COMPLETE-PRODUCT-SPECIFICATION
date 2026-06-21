import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePaymentDto,
  GenerateMonthlyDto,
  QueryPaymentsDto,
  RecordPaymentDto,
} from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto) {
    const status = computeStatus(
      dto.amountDue,
      dto.discount ?? 0,
      0,
      toDateOnly(dto.dueDate),
    );
    return this.prisma.payment.create({
      data: {
        studentId: dto.studentId,
        groupId: dto.groupId,
        periodYear: dto.periodYear,
        periodMonth: dto.periodMonth,
        amountDue: new Prisma.Decimal(dto.amountDue),
        discount: new Prisma.Decimal(dto.discount ?? 0),
        dueDate: toDateOnly(dto.dueDate),
        status,
      },
    });
  }

  async findAll(query: QueryPaymentsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      // Keep payments of hard-deleted students (studentId null, name snapshot)
      // but hide old soft-deleted (demo) students' payments.
      OR: [{ student: { deletedAt: null } }, { studentId: null }],
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.periodYear ? { periodYear: query.periodYear } : {}),
      ...(query.periodMonth ? { periodMonth: query.periodMonth } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ dueDate: 'desc' }],
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          group: { select: { id: true, name: true } },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    // Fall back to the stored name snapshot when the student was deleted.
    const shaped = data.map((p) => ({
      ...p,
      student: p.student ?? { id: null, firstName: p.studentName ?? 'Deleted student', lastName: '' },
    }));
    return paginate(shaped, total, query.page, query.limit);
  }

  /** Record a (partial or full) payment and recompute the status. */
  async record(id: string, dto: RecordPaymentDto) {
    const payment = await this.prisma.payment.findFirst({ where: { id, deletedAt: null } });
    if (!payment) throw new NotFoundException('Payment not found');

    const status = computeStatus(
      Number(payment.amountDue),
      Number(payment.discount),
      dto.amountPaid,
      payment.dueDate,
    );
    return this.prisma.payment.update({
      where: { id },
      data: {
        amountPaid: new Prisma.Decimal(dto.amountPaid),
        status,
        note: dto.note,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
      },
    });
  }

  /**
   * Generate one invoice per active enrollment for the given month, using each
   * group's monthly fee. Idempotent thanks to the unique (student,group,period).
   */
  async generateMonthly(dto: GenerateMonthlyDto) {
    const dueDay = dto.dueDay ?? 5;
    const dueDate = new Date(Date.UTC(dto.periodYear, dto.periodMonth - 1, dueDay));

    const enrollments = await this.prisma.groupStudent.findMany({
      where: { status: 'ACTIVE', group: { deletedAt: null }, student: { status: 'ACTIVE' } },
      include: { group: { select: { id: true, monthlyFee: true } } },
    });

    let created = 0;
    let skipped = 0;
    for (const e of enrollments) {
      const fee = Number(e.group.monthlyFee);
      if (fee <= 0) {
        skipped++;
        continue;
      }
      try {
        await this.prisma.payment.create({
          data: {
            studentId: e.studentId,
            groupId: e.groupId,
            periodYear: dto.periodYear,
            periodMonth: dto.periodMonth,
            amountDue: e.group.monthlyFee,
            dueDate,
            status: computeStatus(fee, 0, 0, dueDate),
          },
        });
        created++;
      } catch (err) {
        // Unique violation → invoice already exists for this period.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          skipped++;
        } else {
          throw err;
        }
      }
    }
    return { created, skipped, total: enrollments.length };
  }

  /**
   * Recompute OVERDUE for all unpaid invoices whose due date has passed.
   * Called by the scheduled job and surfaced as an admin action.
   */
  async recalculateOverdue() {
    const today = startOfToday();
    const result = await this.prisma.payment.updateMany({
      where: {
        deletedAt: null,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
        dueDate: { lt: today },
      },
      data: { status: PaymentStatus.OVERDUE },
    });
    return { updated: result.count };
  }

  /** Revenue figures for the admin dashboard, scoped to a period. */
  async summary(periodYear: number, periodMonth: number) {
    const payments = await this.prisma.payment.findMany({
      where: {
        deletedAt: null,
        OR: [{ student: { deletedAt: null } }, { studentId: null }],
        periodYear,
        periodMonth,
      },
      select: { amountDue: true, discount: true, amountPaid: true, status: true },
    });

    let expected = 0;
    let collected = 0;
    let overdue = 0;
    const byStatus: Record<string, number> = { PAID: 0, PARTIAL: 0, PENDING: 0, OVERDUE: 0 };

    for (const p of payments) {
      const net = Number(p.amountDue) - Number(p.discount);
      const paid = Number(p.amountPaid);
      expected += net;
      collected += paid;
      if (p.status === PaymentStatus.OVERDUE) overdue += net - paid;
      byStatus[p.status]++;
    }

    return {
      period: { year: periodYear, month: periodMonth },
      expectedRevenue: round2(expected),
      collectedRevenue: round2(collected),
      outstandingRevenue: round2(expected - collected),
      overdueRevenue: round2(overdue),
      collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : null,
      invoiceCounts: byStatus,
    };
  }
}

/** Pure status resolver shared by create/record/generate. */
export function computeStatus(
  amountDue: number,
  discount: number,
  amountPaid: number,
  dueDate: Date,
): PaymentStatus {
  const net = Math.max(0, amountDue - discount);
  const outstanding = net - amountPaid;
  if (outstanding <= 0) return PaymentStatus.PAID;
  if (dueDate < startOfToday()) return PaymentStatus.OVERDUE;
  if (amountPaid > 0) return PaymentStatus.PARTIAL;
  return PaymentStatus.PENDING;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
