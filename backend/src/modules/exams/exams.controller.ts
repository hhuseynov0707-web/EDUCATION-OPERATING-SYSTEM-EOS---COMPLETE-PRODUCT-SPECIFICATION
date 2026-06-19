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
import { CreateExamDto, SubmitResultsDto } from './dto/exam.dto';
import { ExamsService } from './exams.service';

@ApiTags('exams')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller('exams')
export class ExamsController {
  constructor(private readonly exams: ExamsService) {}

  @Audit({ action: 'CREATE', entity: 'Exam' })
  @Post()
  create(@Body() dto: CreateExamDto) {
    return this.exams.create(dto);
  }

  @Get()
  findAll(@Query('groupId') groupId?: string) {
    return this.exams.findAll(groupId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.exams.findOne(id);
  }

  @Audit({ action: 'UPDATE', entity: 'ExamResult' })
  @Post(':id/results')
  submitResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitResultsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.exams.submitResults(id, dto, user);
  }

  @Get('student/:studentId/trend')
  studentTrend(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.exams.studentTrend(studentId);
  }
}
