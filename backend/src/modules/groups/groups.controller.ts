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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { CreateGroupDto, EnrollStudentsDto, UpdateGroupDto } from './dto/group.dto';
import { GroupsService } from './groups.service';

@ApiTags('groups')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'CREATE', entity: 'Group' })
  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groups.create(dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get()
  findAll(@Query() query: PaginationDto, @CurrentUser() user: AuthUser) {
    return this.groups.findAll(query, user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.TEACHER)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.groups.findOne(id, user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'UPDATE', entity: 'Group' })
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGroupDto) {
    return this.groups.update(id, dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'DELETE', entity: 'Group' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.groups.remove(id);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'UPDATE', entity: 'GroupEnrollment' })
  @Post(':id/enroll')
  enroll(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EnrollStudentsDto) {
    return this.groups.enroll(id, dto);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Audit({ action: 'UPDATE', entity: 'GroupEnrollment' })
  @Delete(':id/enroll/:studentId')
  unenroll(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.groups.unenroll(id, studentId);
  }
}
