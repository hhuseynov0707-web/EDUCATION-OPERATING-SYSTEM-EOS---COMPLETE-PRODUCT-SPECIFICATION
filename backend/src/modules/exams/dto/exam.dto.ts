import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateExamDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty()
  @IsUUID()
  subjectId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore!: number;
}

export class ResultEntryDto {
  @ApiProperty()
  @IsUUID()
  studentId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class SubmitResultsDto {
  @ApiProperty({ type: [ResultEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultEntryDto)
  results!: ResultEntryDto[];
}
