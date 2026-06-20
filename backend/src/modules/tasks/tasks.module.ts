import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { RiskModule } from '../risk/risk.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [PaymentsModule, RiskModule],
  providers: [TasksService],
})
export class TasksModule {}
