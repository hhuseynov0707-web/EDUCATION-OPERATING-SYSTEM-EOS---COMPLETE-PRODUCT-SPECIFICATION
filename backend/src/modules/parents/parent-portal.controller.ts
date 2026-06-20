import { Controller, ForbiddenException, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ParentsService } from './parents.service';

// Parent-facing, read-only portal — scoped to the logged-in parent's children.
@ApiTags('parent-portal')
@ApiBearerAuth()
@Roles(Role.PARENT)
@Controller('parent')
export class ParentPortalController {
  constructor(private readonly parents: ParentsService) {}

  @Get('children')
  children(@CurrentUser() user: AuthUser) {
    if (!user.profileId) throw new ForbiddenException('No parent profile');
    return this.parents.children(user.profileId);
  }

  @Get('child/:studentId')
  child(@CurrentUser() user: AuthUser, @Param('studentId', ParseUUIDPipe) studentId: string) {
    if (!user.profileId) throw new ForbiddenException('No parent profile');
    return this.parents.childView(user.profileId, studentId);
  }
}
