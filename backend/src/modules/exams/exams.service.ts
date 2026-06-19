import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExamDto, SubmitResultsDto } from './dto/exam.dto';

@Injectable()
export class ExamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExamDto) {
    return this.prisma.exam.create({
      data: {
        name: dto.name,
        subjectId: dto.subjectId,
        groupId: dto.groupId,
        date: new Date(`${dto.date.slice(0, 10)}T00:00:00.000Z`),
        maxScore: new Prisma.Decimal(dto.maxScore),
      },
    });
  }

  findAll(groupId?: string) {
    return this.prisma.exam.findMany({
      where: { deletedAt: null, ...(groupId ? { groupId } : {}) },
      orderBy: { date: 'desc' },
      include: {
        subject: { select: { name: true } },
        group: { select: { id: true, name: true } },
        _count: { select: { results: true } },
      },
    });
  }

  async findOne(id: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, deletedAt: null },
      include: {
        subject: { select: { name: true } },
        group: { select: { id: true, name: true } },
        results: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { score: 'desc' },
        },
      },
    });
    if (!exam) throw new NotFoundException('Exam not found');

    const scores = exam.results.map((r) => Number(r.score));
    const max = Number(exam.maxScore);
    const stats = {
      count: scores.length,
      average: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      highest: scores.length ? Math.max(...scores) : null,
      lowest: scores.length ? Math.min(...scores) : null,
      averagePercentage:
        scores.length && max > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length / max) * 100)
          : null,
    };
    return { ...exam, stats };
  }

  /** Bulk upsert results for an exam (teachers only on their own groups). */
  async submitResults(examId: string, dto: SubmitResultsDto, user: AuthUser) {
    const exam = await this.prisma.exam.findFirst({
      where: { id: examId, deletedAt: null },
      select: { id: true, groupId: true, maxScore: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    await this.assertExamAccess(exam.groupId, user);

    const max = Number(exam.maxScore);
    for (const r of dto.results) {
      if (r.score > max) {
        throw new ForbiddenException(`Score ${r.score} exceeds max ${max} for student ${r.studentId}`);
      }
    }

    await this.prisma.$transaction(
      dto.results.map((r) =>
        this.prisma.examResult.upsert({
          where: { examId_studentId: { examId, studentId: r.studentId } },
          create: {
            examId,
            studentId: r.studentId,
            score: new Prisma.Decimal(r.score),
            note: r.note,
          },
          update: { score: new Prisma.Decimal(r.score), note: r.note },
        }),
      ),
    );
    return { saved: dto.results.length };
  }

  /** Score trend (percentage over time) for a single student. */
  async studentTrend(studentId: string) {
    const results = await this.prisma.examResult.findMany({
      where: { studentId },
      include: { exam: { select: { name: true, date: true, maxScore: true, subject: { select: { name: true } } } } },
      orderBy: { exam: { date: 'asc' } },
    });
    return results.map((r) => ({
      examName: r.exam.name,
      subject: r.exam.subject.name,
      date: r.exam.date,
      score: Number(r.score),
      maxScore: Number(r.exam.maxScore),
      percentage: Number(r.exam.maxScore) > 0
        ? Math.round((Number(r.score) / Number(r.exam.maxScore)) * 100)
        : null,
    }));
  }

  private async assertExamAccess(groupId: string | null, user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER && groupId) {
      const g = await this.prisma.group.findFirst({
        where: { id: groupId, teacherId: user.profileId ?? undefined },
        select: { id: true },
      });
      if (g) return;
    }
    throw new ForbiddenException('Not allowed to modify results for this exam');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
