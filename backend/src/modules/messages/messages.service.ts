import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

// User shape with optional profiles, used to compute a display name.
const userWithProfiles = {
  include: {
    teacher: { select: { firstName: true, lastName: true } },
    parent: { select: { firstName: true, lastName: true } },
  },
} satisfies Prisma.UserDefaultArgs;
type UserWithProfiles = Prisma.UserGetPayload<typeof userWithProfiles>;

function displayName(u: UserWithProfiles): string {
  if (u.teacher) return `${u.teacher.firstName} ${u.teacher.lastName}`;
  if (u.parent) return `${u.parent.firstName} ${u.parent.lastName}`;
  return u.email;
}

export interface Contact {
  userId: string;
  name: string;
  role: Role;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private isAdmin(user: AuthUser) {
    return user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
  }

  /** Send a message to another user (optionally about a student). */
  async send(user: AuthUser, dto: SendMessageDto) {
    if (dto.recipientId === user.userId) {
      throw new BadRequestException('You cannot message yourself');
    }
    const recipient = await this.prisma.user.findFirst({
      where: { id: dto.recipientId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!recipient) throw new NotFoundException('Recipient not found');

    return this.prisma.message.create({
      data: {
        senderId: user.userId,
        recipientId: dto.recipientId,
        studentId: dto.studentId ?? null,
        body: dto.body,
      },
    });
  }

  /** Who the current user is allowed to message. */
  async contacts(user: AuthUser): Promise<Contact[]> {
    const admins = await this.prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] }, isActive: true, deletedAt: null, id: { not: user.userId } },
      ...userWithProfiles,
    });
    const adminContacts = admins.map((u) => ({ userId: u.id, name: displayName(u), role: u.role }));

    if (this.isAdmin(user)) {
      // Admins can message every teacher and parent.
      const people = await this.prisma.user.findMany({
        where: { role: { in: [Role.TEACHER, Role.PARENT] }, isActive: true, deletedAt: null },
        ...userWithProfiles,
        orderBy: { email: 'asc' },
      });
      return people.map((u) => ({ userId: u.id, name: displayName(u), role: u.role }));
    }

    if (user.role === Role.TEACHER) {
      // Parents of students in the teacher's groups.
      const groups = await this.prisma.group.findMany({
        where: { teacherId: user.profileId ?? '__none__', deletedAt: null },
        select: { id: true },
      });
      const groupIds = groups.map((g) => g.id);
      const links = await this.prisma.studentParent.findMany({
        where: { student: { enrollments: { some: { groupId: { in: groupIds }, status: 'ACTIVE' } } } },
        include: { parent: { include: { user: { ...userWithProfiles } } } },
      });
      const parents = dedupe(
        links
          .filter((l) => l.parent.user)
          .map((l) => ({ userId: l.parent.user!.id, name: displayName(l.parent.user!), role: Role.PARENT })),
      );
      return [...parents, ...adminContacts];
    }

    if (user.role === Role.PARENT) {
      // Teachers of the parent's children's groups.
      const children = await this.prisma.studentParent.findMany({
        where: { parentId: user.profileId ?? '__none__' },
        select: { studentId: true },
      });
      const studentIds = children.map((c) => c.studentId);
      const groups = await this.prisma.group.findMany({
        where: {
          deletedAt: null,
          teacherId: { not: null },
          enrollments: { some: { studentId: { in: studentIds }, status: 'ACTIVE' } },
        },
        include: { teacher: { include: { user: { ...userWithProfiles } } } },
      });
      const teachers = dedupe(
        groups
          .filter((g) => g.teacher?.user)
          .map((g) => ({ userId: g.teacher!.user.id, name: displayName(g.teacher!.user), role: Role.TEACHER })),
      );
      return [...teachers, ...adminContacts];
    }

    return adminContacts;
  }

  /** Conversation summaries (one per other participant) for the current user. */
  async threads(user: AuthUser) {
    const messages = await this.prisma.message.findMany({
      where: { OR: [{ senderId: user.userId }, { recipientId: user.userId }] },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        sender: { ...userWithProfiles },
        recipient: { ...userWithProfiles },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const byOther = new Map<string, {
      otherUserId: string;
      otherName: string;
      lastBody: string;
      lastAt: Date;
      unread: number;
    }>();

    for (const m of messages) {
      const isIncoming = m.recipientId === user.userId;
      const other = isIncoming ? m.sender : m.recipient;
      const key = other.id;
      if (!byOther.has(key)) {
        byOther.set(key, {
          otherUserId: other.id,
          otherName: displayName(other),
          lastBody: m.body,
          lastAt: m.createdAt,
          unread: 0,
        });
      }
      if (isIncoming && !m.readAt) {
        byOther.get(key)!.unread += 1;
      }
    }

    return Array.from(byOther.values());
  }

  /** Full conversation with another user; marks incoming messages as read. */
  async conversation(user: AuthUser, otherId: string) {
    await this.prisma.message.updateMany({
      where: { recipientId: user.userId, senderId: otherId, readAt: null },
      data: { readAt: new Date() },
    });

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: user.userId, recipientId: otherId },
          { senderId: otherId, recipientId: user.userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    });

    return messages.map((m) => ({
      id: m.id,
      mine: m.senderId === user.userId,
      body: m.body,
      student: m.student,
      createdAt: m.createdAt,
      readAt: m.readAt,
    }));
  }

  async unreadCount(user: AuthUser) {
    const count = await this.prisma.message.count({
      where: { recipientId: user.userId, readAt: null },
    });
    return { count };
  }

  /** Admin oversight: every message in the system, newest first. */
  async adminAll(take = 100) {
    const messages = await this.prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: { ...userWithProfiles },
        recipient: { ...userWithProfiles },
        student: { select: { firstName: true, lastName: true } },
      },
    });
    return messages.map((m) => ({
      id: m.id,
      from: displayName(m.sender),
      fromRole: m.sender.role,
      to: displayName(m.recipient),
      toRole: m.recipient.role,
      student: m.student ? `${m.student.firstName} ${m.student.lastName}` : null,
      body: m.body,
      createdAt: m.createdAt,
      read: !!m.readAt,
    }));
  }
}

function dedupe(contacts: Contact[]): Contact[] {
  const seen = new Map<string, Contact>();
  for (const c of contacts) if (!seen.has(c.userId)) seen.set(c.userId, c);
  return Array.from(seen.values());
}
