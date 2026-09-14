-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "Admin" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';
