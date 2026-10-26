-- Stock concept removed (explicit spec change): no stock counts, no
-- adjustment audit, no out-of-stock blocking anywhere in the app —
-- overselling is accepted.
--
-- Hand-written on purpose: `prisma migrate dev` cannot express the partial
-- index "User_single_admin" in schema.prisma and would emit a
-- DROP INDEX for it. This migration must not touch that index.

-- 1. The non-negative check from 20260909184644_add_stock_check goes with
--    the column; drop it explicitly so the intent is visible in the log.
ALTER TABLE "ProductVariation" DROP CONSTRAINT IF EXISTS "stock_non_negative";

-- 2. Audit table (empty since the dev-data wipe — nothing is lost).
DROP TABLE "StockAdjustment";

-- 3. The count itself. Dependent indexes ("ProductVariation_stock_idx",
--    if present) are dropped automatically with the column.
ALTER TABLE "ProductVariation" DROP COLUMN "stock";
