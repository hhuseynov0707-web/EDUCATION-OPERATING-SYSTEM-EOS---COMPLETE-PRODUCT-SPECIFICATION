import { Module } from '@nestjs/common';
import { StudentPortalController } from './student-portal.controller';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  controllers: [StudentsController, StudentPortalController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
