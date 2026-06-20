import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBranchDto, CreateProgramDto, CreateSubjectDto } from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Programs ──
  createProgram(dto: CreateProgramDto) {
    return this.prisma.program.create({ data: dto });
  }
  listPrograms() {
    return this.prisma.program.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { subjects: { where: { deletedAt: null }, select: { id: true, name: true } } },
    });
  }

  // ── Subjects ──
  createSubject(dto: CreateSubjectDto) {
    return this.prisma.subject.create({ data: dto });
  }
  listSubjects() {
    return this.prisma.subject.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { program: { select: { id: true, name: true } } },
    });
  }

  // ── Branches ──
  createBranch(dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: dto });
  }
  listBranches() {
    return this.prisma.branch.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }
}
