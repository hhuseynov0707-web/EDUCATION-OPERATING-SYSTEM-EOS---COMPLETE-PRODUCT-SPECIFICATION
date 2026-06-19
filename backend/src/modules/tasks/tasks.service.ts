import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from '../payments/payments.service';
import { RiskService } from '../risk/risk.service';

/**
 * Background maintenance. Runs in-process (no external queue) which is plenty
 * for the target scale. Each job is idempotent and safe to re-run.
 */
@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly risk: RiskService,
  ) {}

  /** 02:00 every day — flip past-due invoices to OVERDUE. */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async nightlyOverdue() {
    const res = await this.payments.recalculateOverdue();
    this.logger.log(`Overdue recalculation: ${res.updated} invoices updated`);
  }

  /** 03:00 every day — recompute risk flags for all active students. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async nightlyRisk() {
    const res = await this.risk.recomputeAll();
    this.logger.log(`Risk recompute: evaluated ${res.evaluated} students`);
  }
}
