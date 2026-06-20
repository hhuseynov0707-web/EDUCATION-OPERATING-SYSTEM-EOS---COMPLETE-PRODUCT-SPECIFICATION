import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class PaySalaryDto {
  @ApiProperty()
  @IsUUID()
  teacherId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  periodYear!: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @ApiPropertyOptional({ description: 'Defaults to the teacher’s monthly salary' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;
}

export class UnpaySalaryDto {
  @ApiProperty()
  @IsUUID()
  teacherId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  periodYear!: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;
}
