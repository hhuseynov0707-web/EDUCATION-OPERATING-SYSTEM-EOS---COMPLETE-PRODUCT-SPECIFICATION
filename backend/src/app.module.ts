import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExamsModule } from './modules/exams/exams.module';
import { GroupsModule } from './modules/groups/groups.module';
import { MessagesModule } from './modules/messages/messages.module';
import { NotesModule } from './modules/notes/notes.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RiskModule } from './modules/risk/risk.module';
import { StudentsModule } from './modules/students/students.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { TeachersModule } from './modules/teachers/teachers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Basic in-memory rate limiting (100 req / 60s per IP).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    CatalogModule,
    StudentsModule,
    TeachersModule,
    GroupsModule,
    MessagesModule,
    AttendanceModule,
    PaymentsModule,
    ExamsModule,
    NotesModule,
    CurriculumModule,
    RiskModule,
    DashboardModule,
    AuditModule,
    TasksModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate first, then authorize, then throttle.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
