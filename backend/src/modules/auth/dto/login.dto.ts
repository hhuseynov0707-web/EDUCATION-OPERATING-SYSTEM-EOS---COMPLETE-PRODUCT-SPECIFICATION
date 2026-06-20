import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@eos.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Admin123!change' })
  @IsString()
  @MinLength(8)
  password!: string;
}
