/*
  Warnings:

  - A unique constraint covering the columns `[employeeId]` on the table `Admin` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "employeeId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Admin_employeeId_key" ON "Admin"("employeeId");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
