import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentsService } from './students.service';

// Student-facing, read-only portal — scoped to the logged-in student.
@ApiTags('student-portal')
@ApiBearerAuth()
@Roles(Role.STUDENT)
@Controller('student')
export class StudentPortalController {
  constructor(private readonly students: StudentsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    if (!user.profileId) throw new ForbiddenException('No student profile');
    return this.students.selfView(user.profileId);
  }
}
