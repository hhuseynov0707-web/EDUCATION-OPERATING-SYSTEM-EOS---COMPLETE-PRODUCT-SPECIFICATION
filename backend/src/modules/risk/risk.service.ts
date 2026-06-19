import { Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma, RiskLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Thresholds for the risk rules. Centralized so they are easy to tune and to
 * surface in the docs. Each rule contributes weighted points to a 0..100 score.
 */
export const RISK_RULES = {
  attendanceMinRate: 70, // %
  attendanceMinSessions: 4, // ignore students with too little history
  overdueDays: 15,
  examDropPct: 15,
  inactivityDays: 10,
  weights: {
    lowAttendance: 30,
    overduePayment: 30,
    examDrop: 25,
    inactivity: 25,
  },
} as const;

interface RiskReason {
  code: string;
  message: string;
  value: number | string;
}

@Injectable()
export class RiskService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recompute every active, non-deleted student. Returns a level breakdown. */
  async recomputeAll() {
    const students = await this.prisma.student.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    const breakdown: Record<RiskLevel, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };
    for (const s of students) {
      const level = await this.recomputeForStudent(s.id);
      breakdown[level]++;
    }
    return { evaluated: students.length, breakdown };
  }

  /** Evaluate one student, persist a current flag (with history on change). */
  async recomputeForStudent(studentId: string): Promise<RiskLevel> {
    const { score, reasons } = await this.evaluate(studentId);
    const level = scoreToLevel(score);

    const last = await this.prisma.riskFlag.findFirst({
      where: { studentId, isCurrent: true },
    });

    // No change → just refresh the timestamp, keep one row.
    if (last && last.level === level && last.score === score) {
      await this.prisma.riskFlag.update({
        where: { id: last.id },
        data: { reasons: reasons as unknown as Prisma.InputJsonValue },
      });
      return level;
    }

    // Changed → archive previous current row and insert a new one (history).
    await this.prisma.$transaction([
      this.prisma.riskFlag.updateMany({
        where: { studentId, isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.riskFlag.create({
        data: {
          studentId,
          level,
          score,
          reasons: reasons as unknown as Prisma.InputJsonValue,
          isCurrent: true,
        },
      }),
    ]);
    return level;
  }

  /** List current flags, optionally filtered by minimum severity. */
  async list(minLevel?: RiskLevel) {
    const order: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const allowed = minLevel ? order.slice(order.indexOf(minLevel)) : order;
    return this.prisma.riskFlag.findMany({
      where: { isCurrent: true, level: { in: allowed }, score: { gt: 0 } },
      orderBy: [{ score: 'desc' }],
      include: {
        student: { select: { id: true, firstName: true, lastName: true, status: true } },
      },
    });
  }

  forStudent(studentId: string) {
    return this.prisma.riskFlag.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // ── Core evaluation ───────────────────────────────────────────────────

  private async evaluate(studentId: string): Promise<{ score: number; reasons: RiskReason[] }> {
    const now = new Date();
    // Promise.all (not $transaction) so Prisma keeps groupBy's precise typing.
    const [attendanceRows, lastPresence, overdue, examResults] =
      await Promise.all([
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: { studentId },
          _count: { _all: true },
          orderBy: { status: 'asc' },
        }),
        this.prisma.attendance.findFirst({
          where: { studentId, status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] } },
          orderBy: { lesson: { date: 'desc' } },
          include: { lesson: { select: { date: true } } },
        }),
        this.prisma.payment.findMany({
          where: { studentId, status: 'OVERDUE', deletedAt: null },
          select: { dueDate: true },
          orderBy: { dueDate: 'asc' },
        }),
        this.prisma.examResult.findMany({
          where: { studentId },
          include: { exam: { select: { date: true, maxScore: true } } },
          orderBy: { exam: { date: 'asc' } },
        }),
      ]);

    const reasons: RiskReason[] = [];
    let score = 0;

    // Rule 1 — low attendance.
    let total = 0;
    let present = 0;
    for (const r of attendanceRows) {
      total += r._count._all;
      if (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE) {
        present += r._count._all;
      }
    }
    if (total >= RISK_RULES.attendanceMinSessions) {
      const rate = Math.round((present / total) * 100);
      if (rate < RISK_RULES.attendanceMinRate) {
        // Scale weight by how far below threshold (max at 0%).
        const severity = (RISK_RULES.attendanceMinRate - rate) / RISK_RULES.attendanceMinRate;
        score += Math.round(RISK_RULES.weights.lowAttendance * (0.6 + 0.4 * severity));
        reasons.push({
          code: 'LOW_ATTENDANCE',
          message: `Attendance ${rate}% is below ${RISK_RULES.attendanceMinRate}%`,
          value: rate,
        });
      }
    }

    // Rule 2 — payment overdue beyond threshold days.
    if (overdue.length > 0) {
      const oldest = overdue[0].dueDate;
      const days = daysBetween(oldest, now);
      if (days > RISK_RULES.overdueDays) {
        score += RISK_RULES.weights.overduePayment;
        reasons.push({
          code: 'OVERDUE_PAYMENT',
          message: `Payment overdue by ${days} days`,
          value: days,
        });
      }
    }

    // Rule 3 — exam score drop between the two most recent exams.
    if (examResults.length >= 2) {
      const last = examResults[examResults.length - 1];
      const prev = examResults[examResults.length - 2];
      const lastPct = pct(Number(last.score), Number(last.exam.maxScore));
      const prevPct = pct(Number(prev.score), Number(prev.exam.maxScore));
      if (lastPct !== null && prevPct !== null) {
        const drop = prevPct - lastPct;
        if (drop > RISK_RULES.examDropPct) {
          score += RISK_RULES.weights.examDrop;
          reasons.push({
            code: 'EXAM_DROP',
            message: `Exam score dropped ${drop}% (${prevPct}% → ${lastPct}%)`,
            value: drop,
          });
        }
      }
    }

    // Rule 4 — no attendance recorded in N+ days.
    if (lastPresence?.lesson) {
      const days = daysBetween(lastPresence.lesson.date, now);
      if (days >= RISK_RULES.inactivityDays) {
        score += RISK_RULES.weights.inactivity;
        reasons.push({
          code: 'INACTIVITY',
          message: `No attendance for ${days} days`,
          value: days,
        });
      }
    }

    return { score: Math.min(100, score), reasons };
  }
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 80) return RiskLevel.CRITICAL;
  if (score >= 55) return RiskLevel.HIGH;
  if (score >= 30) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

function pct(score: number, max: number): number | null {
  return max > 0 ? Math.round((score / max) * 100) : null;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
