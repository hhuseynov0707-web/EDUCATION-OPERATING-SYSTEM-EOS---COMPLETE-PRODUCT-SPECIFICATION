import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TopicStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTopicDto {
  @ApiProperty()
  @IsUUID()
  subjectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderIndex?: number;
}

export class SetTopicStatusDto {
  @ApiProperty()
  @IsUUID()
  topicId!: string;

  @ApiProperty({ enum: TopicStatus })
  @IsEnum(TopicStatus)
  status!: TopicStatus;
}
