import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { CreateStudentDto } from './dto/create-student.dto';
import { QueryStudentsDto } from './dto/query-students.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'CREATE', entity: 'Student' })
  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get()
  findAll(@Query() query: QueryStudentsDto, @CurrentUser() user: AuthUser) {
    return this.students.findAll(query, user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.students.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'UPDATE', entity: 'Student' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'DELETE', entity: 'Student' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.students.remove(id);
  }
}
