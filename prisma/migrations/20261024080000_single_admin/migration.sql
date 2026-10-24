-- Owner spec (2026-10-24): Girah is a single-owner store — at most ONE
-- admin account may ever exist. A partial unique index makes the database
-- itself refuse a second ADMIN row, from any code path (seed, admin UI, a
-- future feature, or a direct SQL mistake).
--
-- NOTE: partial indexes are not expressible in schema.prisma, so this shows
-- up as "drift" to `prisma migrate dev`. `migrate deploy` (dev, CI, prod)
-- replays this file verbatim and is unaffected — never accept a prompt that
-- drops "User_single_admin".
CREATE UNIQUE INDEX "User_single_admin" ON "User"("role") WHERE "role" = 'ADMIN';
