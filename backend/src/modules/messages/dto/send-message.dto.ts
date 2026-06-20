import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  recipientId!: string;

  @ApiPropertyOptional({ description: 'Optional student this message is about' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}
