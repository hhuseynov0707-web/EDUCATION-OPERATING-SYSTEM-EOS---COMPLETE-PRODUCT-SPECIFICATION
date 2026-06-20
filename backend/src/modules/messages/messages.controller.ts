import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@ApiBearerAuth()
@Roles(Role.TEACHER, Role.PARENT, Role.ADMIN, Role.SUPER_ADMIN)
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post()
  send(@CurrentUser() user: AuthUser, @Body() dto: SendMessageDto) {
    return this.messages.send(user, dto);
  }

  @Get('contacts')
  contacts(@CurrentUser() user: AuthUser) {
    return this.messages.contacts(user);
  }

  @Get('threads')
  threads(@CurrentUser() user: AuthUser) {
    return this.messages.threads(user);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.messages.unreadCount(user);
  }

  // Admin oversight — every message in the system.
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('admin/all')
  adminAll() {
    return this.messages.adminAll();
  }

  @Get('with/:userId')
  conversation(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.messages.conversation(user, userId);
  }
}
