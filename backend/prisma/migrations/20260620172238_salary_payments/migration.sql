-- CreateTable
CREATE TABLE "salary_payments" (
    "id" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_payments_teacherId_idx" ON "salary_payments"("teacherId");

-- CreateIndex
CREATE INDEX "salary_payments_periodYear_periodMonth_idx" ON "salary_payments"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "salary_payments_teacherId_periodYear_periodMonth_key" ON "salary_payments"("teacherId", "periodYear", "periodMonth");

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
