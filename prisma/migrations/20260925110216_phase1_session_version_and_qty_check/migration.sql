-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Belt-and-suspenders (Prisma 6 has no @@check support): cart quantities
-- must be at least 1. Application-level validation is the primary guard;
-- this makes negative/zero quantities impossible even via crafted requests
-- that bypass the action layer (girah Phase 1 C1).
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK (quantity >= 1);
