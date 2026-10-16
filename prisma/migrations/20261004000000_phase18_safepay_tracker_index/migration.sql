-- Index the Safepay tracker fallback used by the webhook resolver
-- (findFirst by safepayTracker) so deliveries never scan the orders table.
CREATE INDEX "Order_safepayTracker_idx" ON "Order"("safepayTracker");
