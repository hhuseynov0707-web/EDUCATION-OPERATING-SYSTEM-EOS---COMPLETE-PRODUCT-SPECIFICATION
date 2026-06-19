import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role, RiskLevel } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RiskService } from './risk.service';

@ApiTags('risk')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('risk')
export class RiskController {
  constructor(private readonly risk: RiskService) {}

  @ApiQuery({ name: 'minLevel', required: false, enum: RiskLevel })
  @Get()
  list(@Query('minLevel') minLevel?: RiskLevel) {
    return this.risk.list(minLevel);
  }

  @Get('student/:id')
  forStudent(@Param('id', ParseUUIDPipe) id: string) {
    return this.risk.forStudent(id);
  }

  @Post('recompute')
  recompute() {
    return this.risk.recomputeAll();
  }
}
