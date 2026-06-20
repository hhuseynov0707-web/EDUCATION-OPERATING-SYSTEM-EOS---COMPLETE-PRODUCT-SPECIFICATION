import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin')
  admin() {
    return this.dashboard.admin();
  }

  @Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
  @Get('teacher')
  teacher(@CurrentUser() user: AuthUser) {
    return this.dashboard.teacher(user);
  }
}
