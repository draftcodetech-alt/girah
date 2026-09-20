-- This is an empty migration.
ALTER TABLE "ProductVariation" ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);
