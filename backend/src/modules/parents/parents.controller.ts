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
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { CreateParentDto, ResetParentPasswordDto } from './dto/parent.dto';
import { ParentsService } from './parents.service';

// Admin management of parent accounts.
@ApiTags('parents')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  @Audit({ action: 'CREATE', entity: 'Parent' })
  @Post()
  create(@Body() dto: CreateParentDto) {
    return this.parents.create(dto);
  }

  @Get()
  list() {
    return this.parents.list();
  }

  @Audit({ action: 'DELETE', entity: 'Parent' })
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.parents.remove(id);
  }

  @Audit({ action: 'UPDATE', entity: 'Parent' })
  @Post(':id/reset-password')
  resetPassword(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResetParentPasswordDto) {
    return this.parents.resetPassword(id, dto.newPassword);
  }
}
