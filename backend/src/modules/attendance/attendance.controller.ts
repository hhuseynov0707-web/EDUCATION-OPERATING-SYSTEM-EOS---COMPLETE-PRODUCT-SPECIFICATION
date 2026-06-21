import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { AttendanceService } from './attendance.service';
import { GridQueryDto, HistoryQueryDto, MarkAttendanceDto, RosterQueryDto } from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
// Attendance is a teacher-only tool — admins do not mark or view it here.
@Roles(Role.TEACHER)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('roster')
  roster(@Query() query: RosterQueryDto, @CurrentUser() user: AuthUser) {
    return this.attendance.roster(query, user);
  }

  @Audit({ action: 'UPDATE', entity: 'Attendance' })
  @Post('mark')
  mark(@Body() dto: MarkAttendanceDto, @CurrentUser() user: AuthUser) {
    return this.attendance.mark(dto, user);
  }

  @Get('history')
  history(@Query() query: HistoryQueryDto, @CurrentUser() user: AuthUser) {
    return this.attendance.history(query, user);
  }

  @Get('grid')
  grid(@Query() query: GridQueryDto, @CurrentUser() user: AuthUser) {
    return this.attendance.grid(query, user);
  }
}
