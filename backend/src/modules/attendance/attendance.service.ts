import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, Weekday } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  GridQueryDto,
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

  /**
   * Spreadsheet view: students × class-days for a date range. Columns are the
   * days the group actually meets (from its weekly schedule), plus any dates a
   * lesson already exists. Pre-filled with recorded attendance.
   *
   * Each returned day carries a `seq` — its global lesson number counted
   * continuously from the group's creation date — so the UI can mark every
   * 8th lesson (the academy's payment / salary cycle) even when a cycle spans
   * more than one month.
   */
  async grid(query: GridQueryDto, user: AuthUser) {
    await this.assertGroupAccess(query.groupId, user);
    const from = toDateOnly(query.from);
    const to = toDateOnly(query.to);

    const group = await this.prisma.group.findFirst({
      where: { id: query.groupId, deletedAt: null },
      include: { schedules: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const [enrollments, lessons, allLessons] = await Promise.all([
      this.prisma.groupStudent.findMany({
        where: { groupId: query.groupId, status: 'ACTIVE' },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { student: { lastName: 'asc' } },
      }),
      this.prisma.lesson.findMany({
        where: { groupId: query.groupId, deletedAt: null, date: { gte: from, lte: to } },
        include: { attendance: { select: { studentId: true, status: true } } },
        orderBy: { date: 'asc' },
      }),
      // Every lesson date up to the view, so the lesson counter is stable no
      // matter which month is being looked at (date-only rows — cheap).
      this.prisma.lesson.findMany({
        where: { groupId: query.groupId, deletedAt: null, date: { lte: to } },
        select: { date: true },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Fixed anchor for the 8-lesson counter: the group's first-ever lesson if
    // it predates creation (e.g. backfilled history), otherwise its creation
    // date. Independent of the query range, so seq never shifts between views.
    const createdDate = toDateOnly(group.createdAt.toISOString());
    const firstLesson = allLessons[0] ? toDateOnly(allLessons[0].date.toISOString()) : null;
    const anchor = firstLesson && firstLesson < createdDate ? firstLesson : createdDate;

    // A day is a lesson if the group is scheduled that weekday, or a lesson
    // already exists on it (off-schedule make-ups, etc.).
    const wantWeekdays = new Set(group.schedules.map((s) => s.weekday));
    const lessonDates = new Set<string>(allLessons.map((l) => l.date.toISOString().slice(0, 10)));

    // Walk from the fixed anchor to the end of the range, numbering every
    // class-day; only days inside [from, to] are returned for display.
    const dates: { date: string; seq: number }[] = [];
    let seq = 0;
    for (let d = new Date(anchor); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      if (!wantWeekdays.has(WEEKDAY_ENUM[d.getUTCDay()]) && !lessonDates.has(ds)) continue;
      seq += 1;
      if (d >= from) dates.push({ date: ds, seq });
    }

    // records[studentId][date] = status
    const records: Record<string, Record<string, string>> = {};
    for (const l of lessons) {
      const ds = l.date.toISOString().slice(0, 10);
      for (const a of l.attendance) {
        (records[a.studentId] ??= {})[ds] = a.status;
      }
    }

    return {
      group: { id: group.id, name: group.name },
      dates,
      students: enrollments.map((e) => e.student),
      records,
    };
  }

  /**
   * Attendance is a teacher-only tool — admins (incl. super admin) are blocked
   * here. A teacher may only touch the groups they are assigned to.
   */
  private async assertGroupAccess(groupId: string, user: AuthUser) {
    if (user.role !== Role.TEACHER) {
      throw new ForbiddenException('Attendance is managed by teachers only');
    }
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, teacherId: user.profileId ?? undefined },
      select: { id: true },
    });
    if (!group) throw new ForbiddenException('You are not assigned to this group');
  }
}

// Maps JS getUTCDay() (0=Sun..6=Sat) to the Weekday enum used in schedules.
const WEEKDAY_ENUM: Weekday[] = [
  Weekday.SUN, Weekday.MON, Weekday.TUE, Weekday.WED, Weekday.THU, Weekday.FRI, Weekday.SAT,
];

/** Normalize an ISO date string to a UTC date-only Date (00:00:00). */
function toDateOnly(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}
