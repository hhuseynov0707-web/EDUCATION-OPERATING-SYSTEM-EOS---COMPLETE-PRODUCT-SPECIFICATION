import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTeacherDto } from './create-teacher.dto';

// Email/password are managed through the auth flow, not generic updates.
export class UpdateTeacherDto extends PartialType(
  OmitType(CreateTeacherDto, ['email', 'password'] as const),
) {}
