import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HistoryQueryDto,
  MarkAttendanceDto,
  RosterQueryDto,
} from './dto/attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the active student roster for a group on a date, pre-filled with any
   * attendance already recorded for that lesson. Creates nothing — read only.
   */
  async roster(query: RosterQueryDto, user: AuthUser) {
    await this.assertGroupAccess(query.groupId, user);
    const date = toDateOnly(query.date);

    const [group, enrollments, lesson] = await this.prisma.$transaction([
      this.prisma.group.findFirst({
        where: { id: query.groupId, deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.groupStudent.findMany({
        where: { groupId: query.groupId, status: 'ACTIVE' },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { student: { lastName: 'asc' } },
      }),
      this.prisma.lesson.findUnique({
        where: { groupId_date: { groupId: query.groupId, date } },
        include: { attendance: true },
      }),
    ]);
    if (!group) throw new NotFoundException('Group not found');

    const byStudent = new Map(lesson?.attendance.map((a) => [a.studentId, a]) ?? []);
    return {
      group,
      date: query.date,
      lessonId: lesson?.id ?? null,
      topic: lesson?.topic ?? null,
      students: enrollments.map((e) => ({
        studentId: e.student.id,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        status: byStudent.get(e.student.id)?.status ?? null,
        note: byStudent.get(e.student.id)?.note ?? null,
      })),
    };
  }

  /**
   * One-click bulk save: upserts the lesson then upserts every attendance row in
   * a single transaction. Re-saving the same day overwrites prior marks.
   */
  async mark(dto: MarkAttendanceDto, user: AuthUser) {
    await this.assertGroupAccess(dto.groupId, user);
    const date = toDateOnly(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.upsert({
        where: { groupId_date: { groupId: dto.groupId, date } },
        create: { groupId: dto.groupId, date, topic: dto.topic },
        update: { topic: dto.topic ?? undefined },
      });

      for (const r of dto.records) {
        await tx.attendance.upsert({
          where: { lessonId_studentId: { lessonId: lesson.id, studentId: r.studentId } },
          create: {
            lessonId: lesson.id,
            studentId: r.studentId,
            status: r.status,
            note: r.note,
            markedById: user.userId,
          },
          update: { status: r.status, note: r.note, markedById: user.userId },
        });
      }

      return { lessonId: lesson.id, saved: dto.records.length };
    });
  }

  async history(query: HistoryQueryDto, user: AuthUser) {
    await this.assertGroupAccess(query.groupId, user);
    const lessons = await this.prisma.lesson.findMany({
      where: {
        groupId: query.groupId,
        deletedAt: null,
        ...(query.from || query.to
          ? {
              date: {
                ...(query.from ? { gte: toDateOnly(query.from) } : {}),
                ...(query.to ? { lte: toDateOnly(query.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      include: { attendance: { select: { status: true } } },
    });

    return lessons.map((l) => {
      const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } as Record<string, number>;
      for (const a of l.attendance) counts[a.status]++;
      const total = l.attendance.length;
      return {
        lessonId: l.id,
        date: l.date,
        topic: l.topic,
        counts,
        total,
        presentRate:
          total > 0 ? Math.round(((counts.PRESENT + counts.LATE) / total) * 100) : null,
      };
    });
  }

  /** Teachers may only touch groups they are assigned to. Admins see all. */
  private async assertGroupAccess(groupId: string, user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER) {
      const group = await this.prisma.group.findFirst({
        where: { id: groupId, teacherId: user.profileId ?? undefined },
        select: { id: true },
      });
      if (!group) throw new ForbiddenException('You are not assigned to this group');
      return;
    }
    throw new ForbiddenException('Not allowed');
  }
}

/** Normalize an ISO date string to a UTC date-only Date (00:00:00). */
function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
