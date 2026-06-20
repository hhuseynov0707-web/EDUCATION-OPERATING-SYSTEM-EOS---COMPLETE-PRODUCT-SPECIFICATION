import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import { PaySalaryDto, UnpaySalaryDto } from './dto/salary.dto';
import { SalariesService } from './salaries.service';

// Salaries are financial data — admin only.
@ApiTags('salaries')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('salaries')
export class SalariesController {
  constructor(private readonly salaries: SalariesService) {}

  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'month', required: true })
  @Get()
  overview(@Query('year') year: string, @Query('month') month: string) {
    return this.salaries.overview(Number(year), Number(month));
  }

  @Audit({ action: 'CREATE', entity: 'SalaryPayment' })
  @Post('pay')
  pay(@Body() dto: PaySalaryDto) {
    return this.salaries.pay(dto.teacherId, dto.periodYear, dto.periodMonth, dto.amount);
  }

  @Audit({ action: 'DELETE', entity: 'SalaryPayment' })
  @Post('unpay')
  unpay(@Body() dto: UnpaySalaryDto) {
    return this.salaries.unpay(dto.teacherId, dto.periodYear, dto.periodMonth);
  }
}
