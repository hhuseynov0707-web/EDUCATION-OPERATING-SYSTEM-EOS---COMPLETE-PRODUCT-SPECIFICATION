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
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ResetTeacherPasswordDto } from './dto/reset-password.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Audit({ action: 'CREATE', entity: 'Teacher' })
  @Post()
  create(@Body() dto: CreateTeacherDto) {
    return this.teachers.create(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.teachers.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachers.findOne(id);
  }

  @Audit({ action: 'UPDATE', entity: 'Teacher' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto) {
    return this.teachers.update(id, dto);
  }

  @Audit({ action: 'DELETE', entity: 'Teacher' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachers.remove(id);
  }

  @Audit({ action: 'UPDATE', entity: 'Teacher' })
  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetTeacherPasswordDto,
  ) {
    return this.teachers.resetPassword(id, dto.newPassword);
  }
}
