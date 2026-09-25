-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN     "adminId" TEXT;

-- CreateIndex
CREATE INDEX "StockAdjustment_adminId_idx" ON "StockAdjustment"("adminId");

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
