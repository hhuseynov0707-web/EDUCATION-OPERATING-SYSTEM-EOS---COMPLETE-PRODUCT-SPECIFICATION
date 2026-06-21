import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class RosterQueryDto {
  @ApiProperty()
  @IsUUID()
  groupId!: string;

  @ApiProperty({ example: '2026-06-19' })
  @IsDateString()
  date!: string;
}

export class AttendanceRecordDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class MarkAttendanceDto {
  @ApiProperty()
  @IsUUID()
  groupId!: string;

  @ApiProperty({ example: '2026-06-19' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiProperty({ type: [AttendanceRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordDto)
  records!: AttendanceRecordDto[];
}

export class GridQueryDto {
  @ApiProperty()
  @IsUUID()
  groupId!: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  from!: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  to!: string;
}

export class HistoryQueryDto {
  @ApiProperty()
  @IsUUID()
  groupId!: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
