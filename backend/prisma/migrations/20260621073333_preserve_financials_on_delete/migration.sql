-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_studentId_fkey";

-- DropForeignKey
ALTER TABLE "salary_payments" DROP CONSTRAINT "salary_payments_teacherId_fkey";

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "studentName" TEXT,
ALTER COLUMN "studentId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "salary_payments" ADD COLUMN     "teacherName" TEXT,
ALTER COLUMN "teacherId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
