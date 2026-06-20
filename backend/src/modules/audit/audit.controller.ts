import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditAction, Prisma, Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('audit')
@ApiBearerAuth()
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query() query: PaginationDto,
    @Query('entity') entity?: string,
    @Query('action') action?: AuditAction,
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { id: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }
}
