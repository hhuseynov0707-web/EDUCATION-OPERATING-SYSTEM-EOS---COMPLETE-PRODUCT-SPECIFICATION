import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { StudentsService } from '../students/students.service';
import { CreateParentDto } from './dto/parent.dto';

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentsService,
  ) {}

  // ── Admin: manage parent accounts ──────────────────────────────────────

  /** Remove a stale (soft-deleted/deactivated) parent account holding an email. */
  private async freeStaleEmail(email: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, isActive: true, parent: { select: { deletedAt: true } } },
    });
    if (existing && existing.parent && (existing.parent.deletedAt || existing.isActive === false)) {
      await this.prisma.user.delete({ where: { id: existing.id } });
    }
  }

  async create(dto: CreateParentDto) {
    await this.freeStaleEmail(dto.email);
    const passwordHash = await AuthService.hashPassword(dto.password);
    return this.prisma.parent.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        user: { create: { email: dto.email.toLowerCase(), passwordHash, role: Role.PARENT } },
        children: { create: dto.studentIds.map((studentId) => ({ studentId })) },
      },
      include: {
        user: { select: { email: true, isActive: true } },
        children: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  list() {
    return this.prisma.parent.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: 'asc' }],
      include: {
        user: { select: { email: true, isActive: true } },
        children: { include: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
  }

  async remove(id: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    // Hard delete: removes the parent + child links and frees the login email.
    await this.prisma.user.delete({ where: { id: parent.userId } });
    return { success: true };
  }

  async resetPassword(id: string, newPassword: string) {
    const parent = await this.prisma.parent.findFirst({
      where: { id, deletedAt: null },
      select: { userId: true },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    await this.prisma.user.update({
      where: { id: parent.userId },
      data: { passwordHash: await AuthService.hashPassword(newPassword) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: parent.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  // ── Parent portal: read-only views of own children ─────────────────────

  async children(parentProfileId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { parentId: parentProfileId },
      include: { student: { select: { id: true, firstName: true, lastName: true, status: true } } },
    });
    return links.map((l) => ({ ...l.student, relationship: l.relationship }));
  }

  async childView(parentProfileId: string, studentId: string) {
    const link = await this.prisma.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId: parentProfileId } },
    });
    if (!link) throw new ForbiddenException('This is not your child');

    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
      include: {
        enrollments: {
          where: { status: 'ACTIVE' },
          include: { group: { select: { id: true, name: true, subject: { select: { name: true } } } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const [analytics, notes] = await Promise.all([
      this.students.computeAnalytics(studentId),
      this.prisma.teacherNote.findMany({
        where: { studentId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { teacher: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return { student, analytics, notes };
  }
}
