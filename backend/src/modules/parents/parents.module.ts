import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { ParentPortalController } from './parent-portal.controller';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
  imports: [StudentsModule], // for StudentsService.computeAnalytics
  controllers: [ParentsController, ParentPortalController],
  providers: [ParentsService],
})
export class ParentsModule {}
