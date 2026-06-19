import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { CurriculumService } from './curriculum.service';
import { CreateTopicDto, SetTopicStatusDto } from './dto/curriculum.dto';

@ApiTags('curriculum')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'CREATE', entity: 'CurriculumTopic' })
  @Post('topics')
  createTopic(@Body() dto: CreateTopicDto) {
    return this.curriculum.createTopic(dto);
  }

  @Get('topics')
  listTopics(@Query('subjectId', ParseUUIDPipe) subjectId: string) {
    return this.curriculum.listTopics(subjectId);
  }

  @Get('group/:groupId')
  groupBoard(@Param('groupId', ParseUUIDPipe) groupId: string) {
    return this.curriculum.groupBoard(groupId);
  }

  @Audit({ action: 'UPDATE', entity: 'CurriculumProgress' })
  @Post('group/:groupId/status')
  setStatus(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: SetTopicStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.curriculum.setStatus(groupId, dto, user);
  }
}
