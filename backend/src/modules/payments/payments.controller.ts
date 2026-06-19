import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Audit } from '../../common/decorators/audit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditInterceptor } from '../../common/interceptors/audit.interceptor';
import {
  CreatePaymentDto,
  GenerateMonthlyDto,
  QueryPaymentsDto,
  RecordPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

// Financial data is admin-only — teachers cannot access this controller.
@ApiTags('payments')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Audit({ action: 'CREATE', entity: 'Payment' })
  @Post()
  create(@Body() dto: CreatePaymentDto) {
    return this.payments.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryPaymentsDto) {
    return this.payments.findAll(query);
  }

  @ApiQuery({ name: 'year', required: true })
  @ApiQuery({ name: 'month', required: true })
  @Get('summary')
  summary(@Query('year') year: string, @Query('month') month: string) {
    return this.payments.summary(Number(year), Number(month));
  }

  @Audit({ action: 'UPDATE', entity: 'Payment' })
  @Patch(':id/record')
  record(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    return this.payments.record(id, dto);
  }

  @Audit({ action: 'CREATE', entity: 'Payment' })
  @Post('generate-monthly')
  generateMonthly(@Body() dto: GenerateMonthlyDto) {
    return this.payments.generateMonthly(dto);
  }

  @Audit({ action: 'UPDATE', entity: 'Payment' })
  @Post('recalculate-overdue')
  recalculateOverdue() {
    return this.payments.recalculateOverdue();
  }
}
