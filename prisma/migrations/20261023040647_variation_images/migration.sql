-- CreateTable
CREATE TABLE "ProductVariationImage" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariationImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductVariationImage_variationId_idx" ON "ProductVariationImage"("variationId");

-- AddForeignKey
ALTER TABLE "ProductVariationImage" ADD CONSTRAINT "ProductVariationImage_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
