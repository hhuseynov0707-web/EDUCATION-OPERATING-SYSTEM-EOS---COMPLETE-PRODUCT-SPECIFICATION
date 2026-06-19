import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NoteType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateNoteDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty({ enum: NoteType, default: NoteType.GENERAL })
  @IsEnum(NoteType)
  type!: NoteType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  content!: string;
}
