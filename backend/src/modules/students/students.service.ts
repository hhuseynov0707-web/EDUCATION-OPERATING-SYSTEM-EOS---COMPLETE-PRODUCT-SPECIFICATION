import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user?: AuthUser): boolean {
    return user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
  }

  async create(dto: CreateStudentDto) {
    return this.prisma.student.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        phone: dto.phone,
        email: dto.email,
        status: dto.status,
        enrollmentDate: dto.enrollmentDate ? new Date(dto.enrollmentDate) : undefined,
        branchId: dto.branchId,
      },
    });
  }

  async findAll(query: QueryStudentsDto, user: AuthUser): Promise<PaginatedResult<unknown>> {
    // Teachers only see students enrolled in one of their own groups.
    const teacherScope: Prisma.StudentWhereInput = this.isAdmin(user)
      ? {}
      : { enrollments: { some: { status: 'ACTIVE', group: { teacherId: user.profileId ?? '__none__' } } } };
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...teacherScope,
      ...(query.status ? { status: query.status } : {}),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.groupId
        ? { enrollments: { some: { groupId: query.groupId, status: 'ACTIVE' } } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: {
          branch: { select: { id: true, name: true } },
          enrollments: {
            where: { status: 'ACTIVE' },
            select: { group: { select: { id: true, name: true } } },
          },
          riskFlags: { where: { isCurrent: true }, select: { level: true, score: true } },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string, user?: AuthUser) {
    // Teachers may only view a student who is in one of their groups.
    if (user && !this.isAdmin(user)) {
      const linked = await this.prisma.groupStudent.findFirst({
        where: { studentId: id, status: 'ACTIVE', group: { teacherId: user.profileId ?? '__none__' } },
        select: { id: true },
      });
      if (!linked) throw new ForbiddenException('This student is not in your groups');
    }
    const student = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        enrollments: {
          include: {
            group: { select: { id: true, name: true, subject: { select: { name: true } } } },
          },
        },
        parentLinks: {
          include: { parent: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
        riskFlags: { where: { isCurrent: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const analytics = await this.computeAnalytics(id);
    return { ...student, analytics };
  }

  async update(id: string, dto: UpdateStudentDto) {
    await this.ensureExists(id);
    return this.prisma.student.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        enrollmentDate: dto.enrollmentDate ? new Date(dto.enrollmentDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'LEFT' },
    });
  }

  /** Per-student rollups used by the profile screen and risk engine. */
  async computeAnalytics(studentId: string) {
    // Promise.all (not $transaction) so Prisma keeps groupBy's precise typing.
    const [attendanceRows, payments, examResults] = await Promise.all([
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { studentId },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.payment.findMany({
        where: { studentId, deletedAt: null },
        select: { status: true, amountDue: true, discount: true, amountPaid: true, dueDate: true },
      }),
      this.prisma.examResult.findMany({
        where: { studentId },
        include: { exam: { select: { name: true, date: true, maxScore: true } } },
        orderBy: { exam: { date: 'asc' } },
      }),
    ]);

    const counts: Record<string, number> = {};
    let totalSessions = 0;
    for (const row of attendanceRows) {
      counts[row.status] = row._count._all;
      totalSessions += row._count._all;
    }
    const present = (counts[AttendanceStatus.PRESENT] ?? 0) + (counts[AttendanceStatus.LATE] ?? 0);
    const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : null;

    const overdue = payments.filter((p) => p.status === 'OVERDUE');
    const pending = payments.filter((p) => p.status === 'PENDING' || p.status === 'PARTIAL');
    const outstanding = payments.reduce(
      (sum, p) =>
        sum + Math.max(0, Number(p.amountDue) - Number(p.discount) - Number(p.amountPaid)),
      0,
    );

    const examHistory = examResults.map((r) => ({
      examName: r.exam.name,
      date: r.exam.date,
      score: Number(r.score),
      maxScore: Number(r.exam.maxScore),
      percentage: Number(r.exam.maxScore) > 0
        ? Math.round((Number(r.score) / Number(r.exam.maxScore)) * 100)
        : null,
    }));

    // Simple progress score: average exam percentage blended with attendance.
    const avgExam =
      examHistory.length > 0
        ? Math.round(
            examHistory.reduce((s, e) => s + (e.percentage ?? 0), 0) / examHistory.length,
          )
        : null;
    const progressScore =
      avgExam !== null && attendanceRate !== null
        ? Math.round(avgExam * 0.7 + attendanceRate * 0.3)
        : (avgExam ?? attendanceRate);

    return {
      attendance: {
        rate: attendanceRate,
        totalSessions,
        present: counts[AttendanceStatus.PRESENT] ?? 0,
        absent: counts[AttendanceStatus.ABSENT] ?? 0,
        late: counts[AttendanceStatus.LATE] ?? 0,
        excused: counts[AttendanceStatus.EXCUSED] ?? 0,
      },
      payments: {
        overdueCount: overdue.length,
        pendingCount: pending.length,
        outstandingAmount: Number(outstanding.toFixed(2)),
      },
      exams: { count: examHistory.length, averagePercentage: avgExam, history: examHistory },
      progressScore,
    };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.student.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Student not found');
  }
}
