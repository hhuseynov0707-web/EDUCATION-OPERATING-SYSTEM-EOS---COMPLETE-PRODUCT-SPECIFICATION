import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginatedResult, PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGroupDto,
  EnrollStudentsDto,
  UpdateGroupDto,
} from './dto/group.dto';

/** Remove financial fields (monthlyFee) from a group object for non-admins. */
function stripMoney<T extends { monthlyFee?: unknown }>(group: T): T {
  const { monthlyFee, ...rest } = group;
  return rest as T;
}

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user?: AuthUser): boolean {
    return user?.role === Role.ADMIN || user?.role === Role.SUPER_ADMIN;
  }

  async create(dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        name: dto.name,
        subjectId: dto.subjectId,
        teacherId: dto.teacherId,
        branchId: dto.branchId,
        monthlyFee: new Prisma.Decimal(dto.monthlyFee),
        schedules: dto.schedules
          ? { create: dto.schedules.map((s) => ({ ...s })) }
          : undefined,
      },
      include: { schedules: true },
    });
  }

  async findAll(query: PaginationDto, user: AuthUser): Promise<PaginatedResult<unknown>> {
    const teacherScope = !this.isAdmin(user); // teachers only see their groups
    const where: Prisma.GroupWhereInput = {
      deletedAt: null,
      ...(teacherScope ? { teacherId: user.profileId ?? '__none__' } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.group.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { name: 'asc' },
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          schedules: true,
          _count: { select: { enrollments: true } },
        },
      }),
      this.prisma.group.count({ where }),
    ]);
    const shaped = teacherScope ? data.map(stripMoney) : data;
    return paginate(shaped, total, query.page, query.limit);
  }

  async findOne(id: string, user: AuthUser) {
    const group = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
        schedules: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, status: true } },
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Group not found');

    // Teachers may only open their own groups, and never see fees.
    if (!this.isAdmin(user) && group.teacherId !== (user.profileId ?? null)) {
      throw new ForbiddenException('You are not assigned to this group');
    }

    const coverage = await this.curriculumCoverage(id);
    const shaped = this.isAdmin(user) ? group : stripMoney(group);
    return { ...shaped, curriculumCoverage: coverage };
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.ensureExists(id);
    return this.prisma.$transaction(async (tx) => {
      // When a new schedule is supplied, replace the existing slots entirely.
      if (dto.schedules) {
        await tx.groupSchedule.deleteMany({ where: { groupId: id } });
      }
      return tx.group.update({
        where: { id },
        data: {
          name: dto.name,
          // undefined = leave unchanged; null = unassign teacher.
          teacherId: dto.teacherId === undefined ? undefined : dto.teacherId,
          monthlyFee:
            dto.monthlyFee !== undefined ? new Prisma.Decimal(dto.monthlyFee) : undefined,
          schedules: dto.schedules ? { create: dto.schedules.map((s) => ({ ...s })) } : undefined,
        },
        include: { schedules: true },
      });
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    return this.prisma.group.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'ARCHIVED' },
    });
  }

  /** Enroll a batch of students (idempotent: re-activates dropped enrollments). */
  async enroll(groupId: string, dto: EnrollStudentsDto) {
    await this.ensureExists(groupId);
    const ops = dto.studentIds.map((studentId) =>
      this.prisma.groupStudent.upsert({
        where: { groupId_studentId: { groupId, studentId } },
        create: { groupId, studentId, status: 'ACTIVE' },
        update: { status: 'ACTIVE', leftAt: null },
      }),
    );
    await this.prisma.$transaction(ops);
    return { enrolled: dto.studentIds.length };
  }

  async unenroll(groupId: string, studentId: string) {
    await this.prisma.groupStudent.update({
      where: { groupId_studentId: { groupId, studentId } },
      data: { status: 'DROPPED', leftAt: new Date() },
    });
    return { success: true };
  }

  /** Curriculum completion percentage for a group's subject. */
  async curriculumCoverage(groupId: string) {
    const rows = await this.prisma.curriculumProgress.groupBy({
      by: ['status'],
      where: { groupId },
      _count: { _all: true },
      orderBy: { status: 'asc' },
    });
    let total = 0;
    let completed = 0;
    for (const r of rows) {
      total += r._count._all;
      if (r.status === 'COMPLETED') completed += r._count._all;
    }
    return {
      totalTopics: total,
      completedTopics: completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : null,
    };
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.group.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Group not found');
  }
}
