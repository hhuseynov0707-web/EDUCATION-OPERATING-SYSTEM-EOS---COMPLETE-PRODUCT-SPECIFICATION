import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceStatus, Prisma, Role } from '@prisma/client';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the login User and the Teacher profile atomically. */
  async create(dto: CreateTeacherDto) {
    const passwordHash = await AuthService.hashPassword(dto.password);
    return this.prisma.teacher.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        subjectsTaught: dto.subjectsTaught ?? [],
        employmentDate: dto.employmentDate ? new Date(dto.employmentDate) : undefined,
        salary: dto.salary !== undefined ? new Prisma.Decimal(dto.salary) : undefined,
        user: {
          create: {
            email: dto.email.toLowerCase(),
            passwordHash,
            role: Role.TEACHER,
          },
        },
      },
      include: { user: { select: { id: true, email: true, isActive: true } } },
    });
  }

  async findAll(query: PaginationDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.TeacherWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: [{ lastName: 'asc' }],
        include: {
          user: { select: { email: true, isActive: true, lastLoginAt: true } },
          _count: { select: { groups: true } },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return paginate(data, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { email: true, isActive: true, lastLoginAt: true } },
        groups: {
          where: { deletedAt: null },
          include: {
            subject: { select: { name: true } },
            _count: { select: { enrollments: true } },
          },
        },
      },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const stats = await this.computeStats(id);
    return { ...teacher, stats };
  }

  async update(id: string, dto: UpdateTeacherDto) {
    await this.ensureExists(id);
    return this.prisma.teacher.update({
      where: { id },
      data: {
        ...dto,
        employmentDate: dto.employmentDate ? new Date(dto.employmentDate) : undefined,
        salary: dto.salary !== undefined ? new Prisma.Decimal(dto.salary) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    const teacher = await this.prisma.teacher.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    // Disable the login so a departed teacher cannot authenticate.
    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { isActive: false },
    });
    return teacher;
  }

  /** Teacher performance metrics: student count, attendance quality, improvement. */
  async computeStats(teacherId: string) {
    const groups = await this.prisma.group.findMany({
      where: { teacherId, deletedAt: null },
      select: { id: true },
    });
    const groupIds = groups.map((g) => g.id);

    if (groupIds.length === 0) {
      return { groupCount: 0, studentCount: 0, attendanceQuality: null, avgExamPercentage: null };
    }

    // Promise.all (not $transaction) so Prisma keeps groupBy's precise typing.
    const [studentCount, attendanceRows, examResults] = await Promise.all([
      this.prisma.groupStudent.count({
        where: { groupId: { in: groupIds }, status: 'ACTIVE' },
      }),
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { lesson: { groupId: { in: groupIds } } },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.examResult.findMany({
        where: { exam: { groupId: { in: groupIds } } },
        select: { score: true, exam: { select: { maxScore: true } } },
      }),
    ]);

    let total = 0;
    let present = 0;
    for (const r of attendanceRows) {
      total += r._count._all;
      if (r.status === AttendanceStatus.PRESENT || r.status === AttendanceStatus.LATE) {
        present += r._count._all;
      }
    }
    const attendanceQuality = total > 0 ? Math.round((present / total) * 100) : null;

    const avgExamPercentage =
      examResults.length > 0
        ? Math.round(
            (examResults.reduce(
              (s, r) =>
                s + (Number(r.exam.maxScore) > 0 ? Number(r.score) / Number(r.exam.maxScore) : 0),
              0,
            ) /
              examResults.length) *
              100,
          )
        : null;

    return {
      groupCount: groupIds.length,
      studentCount,
      attendanceQuality,
      avgExamPercentage,
    };
  }

  /** Admin sets a new login password for a teacher. */
  async resetPassword(id: string, newPassword: string) {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    await this.prisma.user.update({
      where: { id: teacher.userId },
      data: { passwordHash: await AuthService.hashPassword(newPassword) },
    });
    // Force re-login everywhere by revoking existing refresh tokens.
    await this.prisma.refreshToken.updateMany({
      where: { userId: teacher.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Teacher not found');
  }
}
