import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNoteDto } from './dto/note.dto';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateNoteDto, user: AuthUser) {
    return this.prisma.teacherNote.create({
      data: {
        studentId: dto.studentId,
        groupId: dto.groupId,
        type: dto.type,
        content: dto.content,
        authorId: user.userId,
        teacherId: user.role === Role.TEACHER ? user.profileId ?? undefined : undefined,
      },
    });
  }

  /** Full chronological note history for a student (newest first). */
  listForStudent(studentId: string) {
    return this.prisma.teacherNote.findMany({
      where: { studentId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true } },
        author: { select: { id: true, email: true, role: true } },
        group: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, user: AuthUser) {
    const note = await this.prisma.teacherNote.findUniqueOrThrow({ where: { id } });
    // Teachers may only delete their own notes; admins may delete any.
    if (
      user.role === Role.TEACHER &&
      note.authorId !== user.userId
    ) {
      throw new ForbiddenException('Cannot delete a note authored by someone else');
    }
    return this.prisma.teacherNote.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
