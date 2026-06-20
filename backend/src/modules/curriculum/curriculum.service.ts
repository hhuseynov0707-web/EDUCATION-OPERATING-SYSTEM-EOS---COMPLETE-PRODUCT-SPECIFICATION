import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, TopicStatus } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTopicDto, SetTopicStatusDto } from './dto/curriculum.dto';

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  createTopic(dto: CreateTopicDto) {
    return this.prisma.curriculumTopic.create({ data: dto });
  }

  listTopics(subjectId: string) {
    return this.prisma.curriculumTopic.findMany({
      where: { subjectId, deletedAt: null },
      orderBy: { orderIndex: 'asc' },
    });
  }

  /**
   * Curriculum board for a group: every topic of the group's subject with its
   * completion status, plus an overall coverage percentage.
   */
  async groupBoard(groupId: string) {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
      select: { id: true, name: true, subjectId: true },
    });
    if (!group) throw new NotFoundException('Group not found');

    const [topics, progress] = await this.prisma.$transaction([
      this.prisma.curriculumTopic.findMany({
        where: { subjectId: group.subjectId, deletedAt: null },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.curriculumProgress.findMany({ where: { groupId } }),
    ]);

    const byTopic = new Map(progress.map((p) => [p.topicId, p]));
    const items = topics.map((t) => ({
      topicId: t.id,
      name: t.name,
      orderIndex: t.orderIndex,
      status: byTopic.get(t.id)?.status ?? TopicStatus.NOT_STARTED,
      completedAt: byTopic.get(t.id)?.completedAt ?? null,
    }));
    const completed = items.filter((i) => i.status === TopicStatus.COMPLETED).length;

    return {
      group,
      totalTopics: items.length,
      completedTopics: completed,
      percentage: items.length > 0 ? Math.round((completed / items.length) * 100) : null,
      topics: items,
    };
  }

  /** Teacher (or admin) marks a topic's status for a group. */
  async setStatus(groupId: string, dto: SetTopicStatusDto, user: AuthUser) {
    await this.assertGroupAccess(groupId, user);
    return this.prisma.curriculumProgress.upsert({
      where: { groupId_topicId: { groupId, topicId: dto.topicId } },
      create: {
        groupId,
        topicId: dto.topicId,
        status: dto.status,
        completedAt: dto.status === TopicStatus.COMPLETED ? new Date() : null,
        completedById: user.userId,
      },
      update: {
        status: dto.status,
        completedAt: dto.status === TopicStatus.COMPLETED ? new Date() : null,
        completedById: user.userId,
      },
    });
  }

  private async assertGroupAccess(groupId: string, user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER) {
      const g = await this.prisma.group.findFirst({
        where: { id: groupId, teacherId: user.profileId ?? undefined },
        select: { id: true },
      });
      if (g) return;
    }
    throw new ForbiddenException('Not assigned to this group');
  }
}
