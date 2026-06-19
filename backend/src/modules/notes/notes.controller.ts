import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { CreateNoteDto } from './dto/note.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Audit({ action: 'CREATE', entity: 'TeacherNote' })
  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: AuthUser) {
    return this.notes.create(dto, user);
  }

  @Get('student/:studentId')
  listForStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.notes.listForStudent(studentId);
  }

  @Audit({ action: 'DELETE', entity: 'TeacherNote' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.notes.remove(id, user);
  }
}
