# contextopencode.md — Girah Project Context Log

> Single-source context for future sessions (opencode / Claude / any agent).
> Session date: **2026-09-25**. Repo: `https://github.com/draftcodetech-alt/girah` (branch `main`).
> Stack: Next.js 16.3.4 · React 19 · Prisma 6.19 + Neon Postgres · NextAuth v5 (credentials/JWT) · Safepay · Cloudinary · Tailwind 4 · Vitest 5.

---

## 0. Project state when this session started

E-commerce store "Girah" (handmade crochet, Pakistan — prices in paisa integers, Rs display, free shipping).
Built through **Phase 8.5** (git history): scaffold → catalog/cart/checkout/payments/accounts → admin products/variations/orders → customers admin + `isActive` flag.

**Working:** auth, catalog+filters, guest/user cart, COD+Safepay checkout, stock decrement transaction, Safepay webhook (HMAC-SHA512, PAID idempotency), account area, full admin (products CRUD, variations/stock audit, orders status + fake-payment guard, customers toggle).
**Known gaps (deferred):** homepage is create-next-app boilerplate (user chose: leave it), reviews module empty, emails empty, `tests/` empty (no runner), lint baseline 11 errors, `/account/shipping` 404 link, temp `test-payment-guard` page, no loading/error pages.

---

## 1. Timeline — what happened, in order

| # | Event | Outcome |
|---|-------|---------|
| 1 | Full codebase read (README, schema, src/, modules, tests) | Audit: made vs left report delivered |
| 2 | User: "freeze to my git, make phased plan + tests" | 8-phase fix plan produced (review-based) |
| 3 | Freeze push attempt | ❌ **403 Permission denied** — `syedareebkareem` had read-only on `draftcodetech-alt/girah` |
| 4 | Diagnosis | `gh api` showed `permissions.push: false`; stored credential-store PAT also resolved to `syedareebkareem` |
| 5 | User granted Write access, said "check again" | ✅ pushed freeze: `6c79b60 Phase 8.5` (+ `26f7c28`), tree clean, 0/0 with remote |
| 6 | User: "find errors/mistakes, review, make manual + automatic test plan, no new features" | 3 parallel deep-review agents ran across auth/admin, cart/checkout/payments, UI/config/Next-16 |
| 7 | Review findings consolidated | 3 critical, 8 high, ~15 medium, ~20 low (summary §3) |
| 8 | Scope questions asked & answered | Safepay retry fix = **yes**; guest-cart merge = **yes**; homepage = **leave**; test infra = **Vitest + Neon test DB** |
| 9 | User: "yes do phase 1 only" | Phase 1 executed, verified, committed, pushed (§4) |
| 10 | User: context file request | this document |

**Commits this session (Phase 1; later phases are listed in their own §N logs):**
- `6c79b60` Phase 8.5: customers admin + user active state — manually verified (freeze push)
- `623e55e` Phase 1: critical security fixes + Vitest harness

---

## 2. Phase plan (agreed, execution in order)

| Phase | Scope | Status |
|-------|-------|--------|
| **1** | Critical security: C1 cart quantity injection, C2 stale-session auth, C3 trustHost/false-success login, .env.example, **Vitest harness** | ✅ **DONE** |
| 2 | Stock & order integrity: restock-on-cancel, duplicate-order race, adjustStock race, order-number retry, state machine, audit actor | ✅ **DONE** (§10) |
| 3 | Safepay flow: retry action + payment-state confirmation page, cancelUrl fix, webhook amount check/JSON guard/refunds | ✅ **DONE** (§11) |
| 4 | Accounts & authz: email lowercase, P2002 handling, profile refresh, toggle `role:CUSTOMER` guard, requireAdmin error UX | ✅ **DONE** (§12) |
| 5 | Cart & catalog: guest-cart merge, qty-0 fix, disabled-line UX, float price filter, Rs. Infinity, filter preservation, shared formatPrice | ✅ **DONE** (§13) |
| 6 | Forms & admin feedback: React-19 form-reset fix (6 forms), action-result handling in admin rows | ✅ **DONE** (§14) |
| 7 | Hygiene: lint → 0, delete temp files, 404/error/loading pages, proxy callbackUrl, Header scoping, TZ dates, README, Prisma cleanup | ✅ **DONE** (§15) |
| 8 | Test automation: CI workflow, committed E2E/smoke suites, cart-stepper result surfacing (Playwright + coverage declined) | ✅ **DONE** (§16) |

**Gate required at end of every phase:** `npm run test` + `npx tsc --noEmit` + `npm run lint` (baseline) + `npx prisma validate` + `npm run build` → commit → push.

**Feature phases (9–16)** — agreed after the fix plan finished. User decisions: storefront-first ordering, transactional emails with **Resend** (dev-log fallback until the key exists), **hand-rolled** CSS/SVG charts, extras = **wishlist + site search** (no coupons, no dark mode).

| Phase | Scope | Status |
|-------|-------|--------|
| **9** | Storefront shell: homepage rewrite, header (search + mobile menu), footer, breadcrumbs, `src/components/ui` primitives | ✅ **DONE** (§17) |
| **10** | Reviews & recommendations: submit/display/moderation, related products, card ratings | ✅ **DONE** (§18) |
| 11 | Admin catalog completeness: product images, price, variation CRUD, category CRUD, delete | ✅ **DONE** (§19) |
| **12** | Account completion: addresses (`SavedShipping` wiring), cancel/reorder/receipt, sub-nav | ✅ **DONE** (§20) |
| 13 | Admin ops & dashboard: metrics, order detail + refund, stock history, filters | ✅ **DONE** (§21) |
| 14 | Emails (Resend): order/status/welcome + forgot/reset password | ✅ **DONE** (§22) |
| 15 | Wishlist + dedicated `/search` results page | ✅ **DONE** (§23) |
| 16 | Design & polish: applied design from the original design doc (florals, homepage, shell, product page, copy, a11y/motion, JSON-LD) | ✅ **DONE** (§24) |

---

## 3. Review findings (source of the phase plan)

### Critical (fixed in Phase 1)
- **C1** `addToCart(variationId, qty)` never validated `qty` → crafted `qty: -50` → stored negative → `stock: { decrement: -50 }` **inflates inventory** + negative-total orders. Files: `src/modules/cart/actions.ts`, `src/modules/checkout/{pricing,stock}.ts`.
- **C2** `isActive` checked **only in `authorize()` at login** → disabled customer kept shopping, disabled **admin kept admin access** for up to 30 days (JWT strategy). Files: `src/lib/auth.ts`, `src/lib/require-admin.ts`.
- **C3** No `trustHost` → on self-hosted production Auth.js returns a 500 JSON Response *without throwing* → `login()` reported **success with no session**; `NEXTAUTH_URL` does not fix this. Files: `src/lib/auth.ts`, `src/modules/accounts/actions.ts`.

### High (Phase 2+)
- H: stock never restocked on cancel/failed payment (no `increment` anywhere)
- H: duplicate-order race (cart read outside transaction)
- H: `adjustStock` read-modify-write lost update + corrupted audit trail
- H: Safepay stranded orders (no retry path, cancelUrl → empty cart, confirmation always says "Confirmed")
- H: React 19 auto-resets `action={fn}` forms on submit → failed submit wipes input (6 forms)
- H: guest cart never merged on login
- H: order-number `GIR-<8 hex>` collision risk, no retry
- H: webhook unguarded `JSON.parse`, no amount/currency verification, signature case sensitivity

### Medium / Low (Phase 4–7)
Email not lowercased (duplicate case-variant accounts) · register/updateProfile TOCTOU `P2002` uncaught · `toggleCustomerActive` can disable admins · admin UI ignores action failure results · `requireAdmin` bare throw → error-boundary 500s · qty-0 cart writes · float `Number(x)*100` price filter · "From Rs. Infinity" on zero-variation product · filters dropped by CategoryTabs/search · `formatPrice` trailing zero ×8 · `/account/shipping` 404 link · `test-payment-guard` temp route live · `.env.example` missing Safepay vars · 11 lint errors · no 404/error/loading pages · Header renders on `/admin` · server-TZ dates · empty barrels/stubs.

### Verified clean (do not re-check)
`requireAdmin()` on all 15 admin exports · IDOR guards (`getMyOrderById`, `ownsCart`) · conditional stock decrement (anti-oversell) · webhook HMAC-SHA512 + `timingSafeEqual` + PAID no-downgrade · `proxy.ts` correct for Next 16 · `params/searchParams` Promise-await everywhere · all theme tokens exist · no `passwordHash` leakage · prices integer paisa throughout checkout.

---

## 4. Phase 1 — detailed log (what & why)

### 4.1 Code changes

| File | Change | Why |
|------|--------|-----|
| `prisma/schema.prisma` | `User.sessionVersion Int @default(0)` | Version counter for instant session invalidation (C2) |
| `prisma/migrations/20260925110216_.../migration.sql` | `ADD COLUMN sessionVersion` + `CHECK (quantity >= 1)` on `CartItem` (raw SQL appended) | DB-level backstop for C1 (Prisma 6 has no `@@check`) |
| `src/lib/account-guard.ts` **(new)** | `getFreshAccount(userId)` → `{isActive, role, sessionVersion} \| null` | Single testable choke point for live authorization state |
| `src/lib/auth.ts` | `trustHost: true`; `jwt` callback: sign-in seeds `token.sessionVersion`; every later read → `getFreshAccount` → null on missing/inactive/version-mismatch (Auth.js then **drops the cookie**); `authorize` returns `sessionVersion` | C3 + C2 |
| `src/lib/auth-types.d.ts` | `sessionVersion?: number` on `User` + `JWT` | Type the new token claim |
| `src/lib/require-admin.ts` | Re-reads account via `getFreshAccount` (not just session claim) | Defense-in-depth: disabled/role-changed admin fails even with stale session object |
| `src/modules/cart/actions.ts` | `isValidQuantity` (int, 0..999; addToCart needs ≥1) **before any DB/Next API call**; `try/catch` + generic error in `addToCart` | C1 |
| `src/modules/checkout/pricing.ts` | `InvalidQuantityError`; quantity int ≥1 check per line | C1 defense-in-depth inside the order transaction |
| `src/modules/checkout/actions.ts` | Catch `InvalidQuantityError` → friendly cart message | Don't 500 on guarded path |
| `src/modules/admin/customers.ts` | `toggleCustomerActive` bumps `sessionVersion` | Disabling instantly kills live JWTs |
| `src/modules/accounts/actions.ts` | `login()` verifies `await auth()` after `signIn` (no false success); `changePassword` bumps `sessionVersion` | C3 + stolen-token invalidation |
| `.env.example` | + `SAFEPAY_API_SECRET`, `NEXT_PUBLIC_APP_URL`, `AUTH_URL`, secret note | Fresh setups were guaranteed-broken (Safepay + auth docs) |
| `eslint.config.mjs` | `no-restricted-imports` off for `tests/**` | Tests need white-box access; boundary rule = production code |
| `vitest.config.ts` / `vitest.integration.config.ts` / `tests/setup/*` | Harness (see §5) | User requirement: automatic tests from Phase 1 |

### 4.2 Key facts verified against installed source (not from memory)

1. **`jwt` returning `null` invalidates the session** — `@auth/core/lib/actions/session.js:34-56`: `token !== null` gate; else `sessionStore.clean()` (cookie removed), body stays `null`.
2. **`signIn` writes cookies into the Next cookie jar before returning** — `next-auth/lib/actions.js` (`cookieJar.set(...)`) → calling `auth()` right after in the same action sees the new session (basis of C3 fix).
3. **Config errors don't throw** — `@auth/core/index.js:72-88` returns `Response.json(500)`; `signIn` then returns a URL without throwing → false `success:true` (the C3 bug mechanism). Bad passwords DO throw (`AuthError && isRaw && !isRedirect` rethrow, line 124) → existing generic error path works.
4. **Next 16 Proxy defaults to Node.js runtime** — `node_modules/next/dist/docs/.../proxy.md:253` → DB reads in `jwt` callback are safe in proxy.
5. **Prisma 6.19.3 has no `@@check`** (even with guessed preview flag; known flags list printed) → raw SQL CHECK in migration.

### 4.3 Manual verification actually performed (production build)

`npm run build` → `PORT=3100 npm run start` (NODE_ENV=production), then curl:

| Step | Result |
|------|--------|
| `GET /api/auth/csrf` + `POST /api/auth/callback/credentials` (valid dev-customer) → `GET /api/auth/session` | ✅ full session JSON (C3: prod login works with `trustHost`) |
| Same flow, wrong password → session | ✅ `null` |
| Disable customer (`isActive=false, sessionVersion+1`) → same cookie session | ✅ `null` instantly (C2) |
| Re-enable (version+1) → old cookie session | ✅ still `null` (stale token dead) |
| Fresh login after bumps | ✅ session issued |
| Admin login → `GET /admin`, `/admin/customers` | ✅ 200 / 200 (new requireAdmin DB check passes) |
| Disable admin → `GET /admin` with same cookie | ✅ 307 → `/` instantly |
| Pages `/, /shop, /login, /register, /cart, /product/crochet-sunflower-bouquet` | ✅ 200 |
| Anon `/admin` → `/`; anon `/account` → `/login` | ✅ 307 (existing proxy behavior) |

### 4.4 Automated tests written (all green: **26/26**)

**Unit** (`tests/unit/`, no DB writes on tested path):
- `cart-qty-validation.test.ts` — 13 cases: `addToCart` rejects `-50, -1, 0, 1.5, NaN, ∞, 100000`; `updateCartItemQuantity` rejects `-1, -50, 1.5, NaN, ∞, 100000` (calls the REAL server actions).

**Integration** (`tests/integration/`, against `girah_test`):
- `account-guard.test.ts` — 5: fresh state, disable reflected, version bump, role change, deleted/empty id → null.
- `cart-qty-check.test.ts` — 3: DB CHECK rejects −5 and 0, accepts 3.
- `pricing-guard.test.ts` — 5: `InvalidQuantityError` for 0/−50/1.5, `UnavailableVariationError` for disabled, correct paisa pricing (2 × 100 000 = 200 000).

### 4.5 Final gate (before commit)

```
npm run test        → 13/13 unit + 13/13 integration PASS
npx tsc --noEmit    → OK (exit 0)
npm run lint        → 11 errors / 3 warnings = EXACT pre-existing baseline (Phase 7 scope)
npx prisma validate → valid
npm run build       → success, 24 routes + proxy
```

---

## 5. Test infrastructure (Vitest + Neon test DB)

```
npm run test            # unit then integration
npm run test:unit       # vitest.config.ts → tests/unit/**
npm run test:integration# vitest.integration.config.ts → tests/integration/**
npm run test:watch      # unit watch mode
```

**How the DB isolation works:**
1. `tests/setup/test-db.ts` — `resolveTestDatabaseUrl()`: uses `DATABASE_URL_TEST` if set (CI), else swaps the main `DATABASE_URL` database name to **`/girah_test`** (same Neon instance).
2. `tests/setup/global.ts` (globalSetup) — `CREATE DATABASE girah_test` if missing (verified it works through the Neon ws adapter), then `prisma migrate deploy` with the test URL.
3. `tests/setup/env.ts` (setupFile, runs before any src import) — sets `process.env.DATABASE_URL` to the test URL so `@/lib/db` can never touch dev/prod.
4. `tests/setup/helpers.ts` — `resetDb()` (TRUNCATE … CASCADE), `createTestUser()`, `createTestProduct()`.
5. Integration config: `fileParallelism: false` (one shared DB), `globalSetup`, longer timeouts.
6. `server.deps.inline: ["next-auth", "@auth/core"]` — required (see §6 errors).

---

## 6. Errors encountered this session & how they were fixed

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | `git push` → `403 Permission to draftcodetech-alt/girah.git denied to syedareebkareem` | GitHub account had read-only role on repo; stored PAT resolved to same account | User granted **Write** collaborator access → push succeeded (`6c79b60`) |
| 2 | `npm i -D vitest` → ERESOLVE: vitest@5 wants `@types/node@^22 \|\| >=24`, repo had `^20` | Peer-dep conflict | Installed `@types/node@^22` (matches actual Node 22 runtime) → tsc still green |
| 3 | Vitest unit run: `Cannot find module '.../next/server' imported from next-auth/lib/env.js` | `next-auth` externalized → Node's native ESM loader can't resolve extensionless `next/server` (Next has no `exports` map) | `test.server.deps.inline: ["next-auth", "@auth/core"]` → processed by Vite resolver |
| 4 | `prisma validate` on `@@check` → "not a valid field or attribute definition"; with `previewFeatures=["checkIt"]` → "preview feature not known" (flag list printed) | Prisma 6.19 doesn't support check constraints in schema | Raw SQL `ALTER TABLE "CartItem" ADD CONSTRAINT ... CHECK (quantity >= 1)` appended to a `--create-only` migration, then `prisma migrate dev` applied |
| 5 | `tsx` toggle script: `Top-level await is currently not supported with the "cjs" output format` | Project is CJS (no `"type":"module"`) — top-level await illegal | Wrapped in `async function main()` + `main().catch()` — first run silently failed so session test showed false "still valid"; re-ran correctly |
| 6 | `pkill -f "next start"` killed my own shell ("Unknown: ChildProcess.kill") | Pattern matched the executing command's own cmdline | Find PID via `ss -ltnp \| grep :3100` → `kill $PID` |
| 7 | Lint went 11 → **12 errors** after tests added | `tests/integration/pricing-guard.test.ts` violated modith boundary rule; `global.ts` unused `path` import | ESLint flat-config override: rule OFF for `tests/**` (tests need internals); removed unused import → back to exact baseline 11 |
| 8 | First `git status` mid-session showed Phase 8.5 files already committed | User (or prior session) had already committed the freeze as `6c79b60` | Just pushed |
| — | (Historical, pre-session) `next build`/lint not run by user before | — | `next lint` removed in Next 16; `npm run lint` (eslint) works and was kept at baseline |

---

## 7. How to manually test (reproduce everything)

### 7.1 Automated (fastest)
```bash
npm run test          # 53 tests: 19 unit + 34 integration
# Requires .env with DATABASE_URL (creates/migrates girah_test automatically)
```

### 7.2 Full auth/session session-kill drill (browser)
```bash
npm run dev           # or: npm run build && npm run start  (prod mode — recommended to prove trustHost)
```
1. **Login works:** open `http://localhost:3000/login` → `dev-customer@girah.test` / `DevCustomer123!` → lands on `/account` with "Welcome back".
2. **Kill the live session (C2):** in another terminal:
   ```bash
   npx tsx -e '
   import("dotenv").then(async (d) => { d.config();
     const { PrismaClient } = await import("@prisma/client");
     const { PrismaNeon } = await import("@prisma/adapter-neon");
     const { neonConfig } = await import("@neondatabase/serverless");
     neonConfig.webSocketConstructor = (await import("ws")).default;
     const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
     const u = await db.user.update({ where: { email: "dev-customer@girah.test" },
       data: { isActive: false, sessionVersion: { increment: 1 } } });
     console.log("disabled:", u.email, u.isActive, u.sessionVersion);
     await db.$disconnect();
   });'
   ```
   Refresh the already-open `/account` page → **redirected to `/login`** (old session dead instantly).
3. **Re-enable** (same script with `isActive: true` — version increments again) → old tab still logged out; **fresh login works**.
4. **Admin version:** login `dev-admin@girah.test` / `DevAdmin123!` → `/admin` loads → disable admin → refresh `/admin` → kicked to `/` → re-enable → re-login OK.

### 7.3 C1 — negative quantity is impossible
- **Action layer:** `npm run test:unit` (real `addToCart(id, -5)` returns `{success:false, error:"Invalid quantity."}`).
- **DB layer (raw SQL):**
  ```sql
  BEGIN;
  INSERT INTO "CartItem" (id, "cartId", "variationId", quantity)
  VALUES ('x', '<valid-cart-id>', '<valid-variation-id>', -5);  -- ERROR: check constraint "CartItem_quantity_positive"
  ROLLBACK;
  ```
- **UI negative qty:** not reachable through the UI (stepper min 1) — the point is the crafted-request path; unit test covers it.

### 7.4 C3 — production login (trustHost)
```bash
npm run build && PORT=3100 npm run start
JAR=/tmp/j.txt
CSRF=$(curl -s -c $JAR localhost:3100/api/auth/csrf | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
curl -s -b $JAR -c $JAR -o /dev/null -X POST localhost:3100/api/auth/callback/credentials \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=dev-customer@girah.test" \
  --data-urlencode "password=DevCustomer123!" --data-urlencode "callbackUrl=/" --data-urlencode "json=true"
curl -s -b $JAR localhost:3100/api/auth/session   # → user JSON (before fix: null/500 in prod)
```

### 7.5 Regression sweep (any phase)
`/, /shop, /login, /register, /cart, /product/crochet-sunflower-bouquet` → 200 · anon `/admin` → 307 `/` · anon `/account` → 307 `/login` · `npm run lint` stays ≤ 11 errors · `npx tsc --noEmit` clean · `npm run build` succeeds.

---

## 8. Conventions & rules established

- **No new features** until the bug-fix phases complete; homepage stays boilerplate (user decision).
- Phase order: 2 → 3 → 4 → 5 → 6 → 7 → 8; each ends with gate (§2) + commit + push to `origin/main`.
- Module boundary lint rule governs `src/**` only; `tests/**` exempt.
- Server actions: validate all inputs at the top (before `cookies()`/DB); return `{success:false, error}` — never trust client numbers.
- Authz: `requireAdmin()` first line of admin actions; live account state via `getFreshAccount()`; never trust JWT claims alone.
- Money: integer paisa everywhere; `formatPrice` fix deferred to Phase 5.
- Test DB: only `girah_test` / `DATABASE_URL_TEST` — never dev/prod (`tests/setup/env.ts` guarantees).
- Doc comments citing `girah.md` / `implementation-plan.md` / `technical-design.md` were historical (those files were never in the repo). **Phase 7 decision: dropped the dead citations, kept the reasoning** — do not cite files that aren't in the repo; cite this document instead (§15.2).

## 9. Immediate next step

**All phases (1–16) are complete.** Phase 16 (§24) applied the original design doc (`initial design/claude.md`) across the storefront: rembg floral cutouts, hero/magazine/immersive homepage, header/footer/full-screen menu, product accordions + mini-cart drawer, spec copy passes, motion/a11y tokens, gated Instagram showcase, JSON-LD. Gate: `npm run test` 591/591, lint 0/0, build green, smoke 21/21, E2E **279/279**, leftovers 0.

Still owed by the user: the one deferred manual-browser pass over **§14.5, §15.5, §17.5, §18.5, §19.5, §20.5, §21.5, §22.5, §23.5** plus the new Phase 16 visual checklist **§24.5** (server on `:3100`). After that: final review of the Phase 16 commit/CI run, and `initial design/` stays uncommitted forever (commit with `git add -A -- . ':!initial design'`).

---

## 10. Phase 2 — detailed log (what & why)

All six planned fixes implemented; gate green; pushed.

### 10.1 Fixes
| # | Fix | Where |
|---|-----|-------|
| 1 | **Duplicate-order race**: cart re-read inside the tx (abort if empty) + exactly-counted `cartItem.deleteMany` (`count !== freshItems.length` → `CartAlreadyCheckedOutError` → rollback undoes stock decrement). Logic extracted to `placeOrderCore(data, identity, userId)` so tests can run without Next request context; `actions.ts placeOrder` = zod → identity/auth → core → Safepay → revalidate. | `src/modules/checkout/place-order.ts` |
| 2 | **Order status state machine**: `ALLOWED_TRANSITIONS` (linear forward; DELIVERED/CANCELLED terminal; same-status = idempotent no-op) + restock on `→CANCELLED` **only if paymentStatus ≠ PAID** (refund path = Phase 3) + CAS `updateMany` on `{id, orderStatus, paymentStatus}` for concurrent-change detection + restock rows sorted by variationId (deadlock principle). Extracted to `updateOrderStatusCore(orderId, input, adminId)`. | `src/modules/admin/order-ops.ts` |
| 3 | **adjustStock atomic**: conditional `updateMany` with `increment` (+ `stock: {gte: -adjustment}` when negative — same idiom as `decrementStockForItems`), then same-tx re-read (lock still held) for exact audit prev/new values; `NegativeStockError`/`VariationNotFoundError` → friendly messages. Extracted to `adjustStockCore(variationId, input, adminId)`. | `src/modules/admin/variation-ops.ts` |
| 4 | **Order number**: 12 hex chars (`GIR-` + 12, 16^12 space) + `createOrderWithRetriableNumber` — SAVEPOINT/ROLLBACK-TO per attempt (PG poisons a tx after any constraint error), retries ≤3 on P2002 targeting orderNumber only. | `src/modules/checkout/order-number.ts` |
| 5 | **deleteProduct**: comment corrected (OrderItem.variationId & CartItem.variationId are LIVE restrict FKs — frozen names are extra metadata, not a substitute) + catches P2003/P2014 → friendly error; P2025 → "Product not found." | `src/modules/admin/products.ts` |
| 6 | **Who-audited**: `StockAdjustment.adminId String?` + relation (SetNull) + index; set by both `adjustStockCore` and cancel-restock. Migration `20260925114628_phase2_stock_adjustment_admin`. | `prisma/schema.prisma` |

Wrappers (`orders.ts`, `variations.ts`, `actions.ts`) keep authz (`requireAdmin` → `session.user.id` passed to core) + `revalidatePath`; cores are plain modules (not `"use server"`), so tests bypass request context but production can't be tricked into passing a spoofed adminId.

### 10.2 Tests added (27 new → total 53)
- `tests/unit/order-number.test.ts` (6): format, 20k-sample uniqueness, `isOrderNumberCollision` matrix.
- `tests/integration/duplicate-order.test.ts` (3): 3-way concurrent checkout → exactly 1 order / 1 decrement / cart empty; sequential second → "cart is empty"; missing cart.
- `tests/integration/stock-race.test.ts` (2): two carts ×3 vs stock5 → one order, stock 2; qty>stock → rejected, stock & cart untouched.
- `tests/integration/adjust-stock-concurrency.test.ts` (6): 3 concurrent ± adjustments → all applied (no lost updates), audit algebra consistent + adminId; chain exactness; negative → rejected+rolled back; missing variation; zod validation.
- `tests/integration/cancel-restock.test.ts` (7): unpaid cancel → restock all items + attributed audit rows with exact prev/new/reason; PAID cancel → no restock; backwards/skip transitions rejected; DELIVERED/CANCELLED terminal; same-status no-op; valid advance path; invalid input/missing order.
- `tests/integration/order-number-retry.test.ts` (3): forced collision → savepoint rollback + retry + **tx still usable**; non-collision errors not retried; attempts exhaustion → original P2002.

### 10.3 Gate & manual verification
- `npm run test` → **53/53**; `tsc --noEmit` clean; `npm run lint` → exact baseline **11 errors / 3 warnings**; `prisma validate` ok; `npm run build` → 24 routes + proxy.
- **E2E on prod `next start :3100` → 28/28 checks** (script `/tmp/opencode/phase2-e2e.mjs`, drives real server actions via `Next-Action` header): page regressions 200 + anon admin 307; guest addToCart; **double-click checkout → exactly one order** (stock −2 once, cart emptied, `GIR-473368981E46` 12-hex); admin credentials login (302 + session cookie); **cancel → restock + audit row attributed to dev-admin with exact prev/adj/new**; CANCELLED→CONFIRMED rejected (terminal); adjustStock −3 with adminId audit; −99999 rejected; stock restored afterwards.

### 10.4 Errors hit in Phase 2 & fixes
| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | adjustStock negative test failed: raw `PrismaClientUnknownRequestError … 23514 stock_non_negative` instead of friendly message | DB CHECK (from earlier migration) fires during the UPDATE — in-tx `stock < 0` check after the update was unreachable | Conditional `updateMany` with `stock: {gte: -adjustment}` (idiom of `decrementStockForItems`) → count 0 → `NegativeStockError`; CHECK stays as backstop |
| 2 | lint 11 → 12 | `place-order.ts` imported `@/modules/cart/identity` (boundary rule: index only) | exported `CartIdentity` type from `cart/index.ts`, imported from `@/modules/cart` |
| 3 | tsc: 4× TS2531 in `cancel-restock.test.ts` | `findUnique(...).stock` on nullable | `findUniqueOrThrow` |
| 4 | E2E admin login: 200 + no session cookie | default `redirect:"follow"` — undici drops Set-Cookie on the 302 | `redirect:"manual"`, assert 302 + `authjs.session-token` present |
| 5 | E2E `dbQuery` JSON parse broke twice | dotenv `◇ injected env` stdout noise; number results (`5`) not `{`/`[`-prefixed | `config({quiet:true})` + `RESULT:` line prefix |
| 6 | `pkill -f "next start…"` → `Unknown: ChildProcess.kill` (known, §6 #6) | pattern matches own cmdline | `fuser -k 3100/tcp` |

---

## 11. Phase 3 — Safepay flow — detailed log

All P3 tasks complete; gate green; **E2E 55/55**; pushed.

### 11.1 Scope decisions (user-confirmed)
1. **Auto-refund on cancel**: cancelling a PAID Safepay order calls the refund API first — success → cancel + restock + `paymentStatus=REFUNDED`; API failure → cancellation refused, order untouched. Missing tracker (legacy orders) → error directing admin to dashboard-refund first (no new admin button; Phase 6 adds result feedback).
2. **COD PAID cancel** → `REFUNDED` + restock + audit reason `… — payment refunded` (cash returned offline).
3. **Retry ("Pay now") button on the confirmation page only** (not account pages).
4. **Restock rule simplified: CANCELLED ⇒ always restock** (Phase 2's "skip if PAID" carve-out existed only because refunds didn't exist yet; `REFUNDED ≠ PAID` so the CAS stays sound). Webhook refund events set REFUNDED but never restock (restock pairs only with CANCELLED).
5. Directive: **minimize limitations** — actively research Safepay payload/API shapes instead of assuming.

### 11.2 Research findings (pinned down, not guessed)
- **Two signature schemes** accepted (same secret ⇒ no added attack surface): legacy **HMAC-SHA512 over raw body**, lowercase hex vs `X-SFPY-SIGNATURE` (real-tested, matches pre-existing code + Safepay's ASP.NET guide); new Raast Wire v1 **HMAC-SHA256 over `timestamp + "." + rawBody`**, key = base64-decoded secret, `sha256=<hex>`, ±5 min window vs `X-SFPY-SIGNATURE`/`X-SFPY-TIMESTAMP`. Comparison case-insensitive; missing secret fails CLOSED with a loud log.
- **Documented payload** (safepay-docs.netlify.app webhook-types): `{ type, version, data: { tracker: "track_<uuid>", amount, currency, metadata: { order_id }, … } }` — `amount` = lowest denomination, `currency` = ISO. Legacy real events: `payment.succeeded` / `payment.failed` (failed observed with EMPTY metadata → fallback order resolution by stored `safepayTracker`). Event taxonomy accepted: succeeded/completed/settled → PAID; failed/rejected → FAILED; refunded/refund_partial/reversed/refund.completed → REFUNDED; unknown → log + 200.
- **Refund endpoint** (SDK `order.cancel.refund` + official GitHub issue): `POST /order/payments/v3/{tracker}/refund`, body `{ currency: "PKR", amount }`, merchant-secret auth (same instance as checkout). New v1 Raast refund (`debitor_iban` etc.) is NOT applicable.
- `resourceNamespace` → call shape is `safepay.order.cancel.refund(tracker, {…})`; non-optional URL param consumed first, rest becomes POST body.

### 11.3 Fixes / changes
| # | Change | Where |
|---|--------|-------|
| 1 | **`Order.safepayTracker String?`** — CAS-persisted at every checkout/retry (`paymentStatus in [PENDING,FAILED]` — never overwrites a PAID order's refund target); refreshed with authoritative `data.tracker` ONLY inside the PAID-transition CAS. Migration `20260925122806_phase3_safepay_tracker`. | `prisma/schema.prisma`, `payments/safepay.ts` |
| 2 | **Signature verification**: dual-scheme, case-insensitive, fail-closed on missing secret, `timingSafeEqual` with length guard, replay window for the timestamped scheme. | `modules/payments/verify-webhook.ts` |
| 3 | **Webhook pipeline extracted** from the route: JSON guard → 400 (after sig check); presence-guarded amount/currency checks (wrong value → refuse PAID + CRITICAL log, 200); atomic CAS transitions (success: `notIn [PAID,REFUNDED]`; failure: `PENDING` only; refund: `PAID` only); order resolution by `metadata.order_id` **or stored tracker**; non-SAFEPAY orders ignored; unknown types acknowledged; **late payment on a CANCELLED order → live auto-refund → REFUNDED, else PAID + CRITICAL log**. Route is now a thin wrapper importing via the index (boundary-clean). | `modules/payments/webhook-core.ts`, `app/api/webhooks/safepay/route.ts` |
| 4 | **`refundSafepayPayment(tracker, amount)`** — throws `SafepayRefundError` on network/HTTP error OR 200-with-`status.errors` so callers never mutate state on a failed refund. `payments/index.ts` barrel populated. | `modules/payments/safepay.ts`, `payments/index.ts` |
| 5 | **Refund-on-cancel**: pre-tx refund (Safepay PAID) → CAS sets `CANCELLED` + `REFUNDED` (when wasPaid) + restock **always on CANCELLED**; audit reason gains ` — payment refunded`; catch block CRITICAL-logs if the refund went out but the tx failed. | `modules/admin/order-ops.ts` |
| 6 | **Retry payment**: `retrySafepayPayment(orderId)` (pure result — refuses PAID/REFUNDED/CANCELLED/non-Safepay/missing; fresh session + tracker persistence) + `startSafepayRetry` (redirect wrapper for the form). | `modules/orders/actions.ts` |
| 7 | **Confirmation page state view**: pure `getConfirmationView` (Confirmed / Pending+Pay Now / Failed+Pay Now / Refunded / Cancelled / COD cash copy) + banners for `?cancelled=1` (abort note, suppressed once CANCELLED/PAID) and `?payment_error=1`; bound retry form. | `modules/orders/confirmation.ts`, `app/(storefront)/order/[id]/confirmation/page.tsx` |
| 8 | **cancelUrl** → `/order/<id>/confirmation?cancelled=1` (initial checkout AND retry). | `modules/checkout/actions.ts` |
| 9 | Boundary hygiene while touching files: `checkout/actions.ts` → `@/modules/payments` + `@/modules/cart` (incl. exporting `resolveCartIdentity` from the cart barrel) — **lint 11 → 8 errors**, no new violations. | `modules/{checkout,cart}/…` |

### 11.4 Tests added (49 new → total 102)
- `tests/unit/verify-signature.test.ts` (12): legacy accept + hex casing, wrong secret, tampered body, missing header, **fail-closed without secret**, timestamped accept, uppercase hex, stale ts, tampered body, missing ts, wrong key derivation.
- `tests/unit/confirmation-view.test.ts` (9): every state → heading/retry; abort banner rules; paymentError flag.
- `tests/integration/webhook.test.ts` (16, SDK mocked): 401 path; PAID + tracker persist; idempotent duplicate (no post-PAID tracker overwrite); failed→succeeded and late-failed sequences; empty-metadata tracker resolution; amount/currency refusal; COD ignore; unknown type; malformed 400; no-order 200; refund event without restock; late-payment auto-refund (success/fail/no-tracker).
- `tests/integration/refund-cancel.test.ts` (6, SDK mocked): COD PAID → REFUNDED+restock+reason; Safepay PAID → refund called with (tracker,total) then REFUNDED+restock; refund rejection → order/stock untouched; missing tracker → dashboard message; unpaid cancel (no refund call); already-REFUNDED cancel (no double refund).
- `tests/integration/retry-payment.test.ts` (6, SDK+axios mocked so the REAL persistence runs): fresh session + tracker + cancel/redirect URLs on confirmation page; second retry replaces tracker while PENDING; PAID refusal leaves tracker; REFUNDED/CANCELLED/COD/missing refusals; Safepay API failure → friendly error, no tracker write.
- Rewrote Phase 2's `cancel-restock` PAID test → now expects **REFUNDED + restock** (COD).

### 11.5 Gate & manual verification
- `npm run test` → **102/102**; `tsc --noEmit` clean; `npm run lint` → **8 errors / 3 warnings** (≤ baseline 11/3 — 3 boundary errors fixed); `prisma validate` ok; `prisma migrate status` up to date; `npm run build` → 24 routes + proxy.
- **E2E on prod `next start :3100` → 55/55** (`/tmp/opencode/phase3-e2e.mjs`, real secret from `.env` — NOTE: value is **quoted** in `.env`, dotenv strips it, a naive regex does not): page regressions + anon 307; **webhook suite** (401 bad sig / signed PAID + tracker / dup no-overwrite / amount+currency refusal / failed↔succeeded / COD ignore / refund event / unknown type / malformed 400 / late-payment auto-refund attempted **live** → `SafepayInvalidRequestError: invalid token pattern` → recorded CANCELLED+PAID with CRITICAL log); **confirmation page states** (all 6 + both banners); admin login; **cancel refusals live** (no tracker → dashboard message; bogus tracker → sandbox rejects `invalid token pattern` → `NOT cancelled`, order untouched); **real sandbox checkout** (`track_7148c900…` persisted, checkoutUrl handed to browser) → **retry creates new tracker** → signed webhook marks PAID → **retry refused, tracker preserved** → live cancel → sandbox `cannot refund tracker in state TRACKER_STARTED` → **refusal surfaced, order CONFIRMED/PAID untouched**; COD PAID cancel → CANCELLED/REFUNDED + restock + attributed audit with `— payment refunded`; unpaid SAFEPAY cancel → restock, payment untouched.

### 11.6 Errors hit in Phase 3 & fixes
| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | E2E webhooks all 401 (server log: `signature verification FAILED`) while tests passed | `.env` value is **quoted** (`SAFEPAY_WEBHOOK_SECRET="…"`) — dotenv strips quotes server-side, script regex didn't | strip surrounding quotes in the script to mirror dotenv |
| 2 | `webhook: … no tracker anywhere` test failed — refund called with the event's tracker | payload still carried `data.tracker`; handler uses `eventTracker ?? order.safepayTracker` by design | test now delivers a payload with no tracker at all |
| 3 | tsc: `Prisma.OrderUncheckedCreateInput` requires all fields / TS2783 overwrite | typed `overrides` as the full input | `Partial<Prisma.OrderUncheckedCreateInput>` |
| 4 | `deliverWebhook` opts typing (`string\|null\|undefined`) | `"signature" in opts` narrowing | dropped the unused opts param |
| 5 | E2E script: `fetch failed — other side closed` at three different points | stale keep-alive sockets after long child-process `dbQuery` gaps (server closes idle sockets; undici reuses) | `safeFetch` retry-once on `UND_ERR_SOCKET`/`ECONNRESET` everywhere + seeds batched into ONE dbQuery |
| 6 | Unit-test mock interference risk (webhook vs retry need different mocks of the same module) | — | per-file `vi.mock` (isolated module registry per test file): webhook/refund mock `@/modules/payments/safepay`; retry mocks the SDK boundary `@sfpy/node-core`+`axios` instead |

---

## 12. Phase 4 — accounts & authz — detailed log

All 14 fixes complete; gate green; **E2E 66/66**; no schema migration.

### 12.1 Scope decisions (user-confirmed)
1. **M3 rate limit: yes, add it** — minimal in-memory throttle inside `authorize()` (the choke point every credentials login passes through, including raw `/api/auth` calls).
2. **M4 logout: bump `sessionVersion`** — logout kills EVERY session for the account (incl. copied/stolen cookies); one counter = all devices sign in again. Same semantics password-change already had.
3. **L11 keep auto-logout, fix the message** — changePassword still bumps (stolen-token kill) but the UI now says "✓ Password changed — please sign in again." + a "Sign in again" link instead of silently contradicting itself.

### 12.2 Fixes
| # | Fix | Where |
|---|-----|-------|
| 1 | **M3 login throttle**: pure in-memory `checkRateLimit` logic (fixed window, injectable clock, pruning, per-key isolation) + wired into `authorize(credentials, request)`: key = `lowercased-email\|x-forwarded-for`, **5 failures / 15 min**, check BEFORE any DB work, record on every failure path, reset on success; over-limit → `null` (indistinguishable from bad credentials). Per-process Map = correct scope for the single `next start` deployment. | `src/lib/rate-limit.ts`, `src/lib/auth.ts` |
| 2 | **L6 profile refresh**: `getFreshAccount` select += `name, email`; `jwt` callback refreshes `token.name`/`token.email` on every read (same query, no extra round-trip) — rename/email-change visible without re-login (verified in E2E via `/api/auth/session`). | `src/lib/account-guard.ts`, `src/lib/auth.ts` |
| 3 | **L1 email normalize**: `.trim().toLowerCase()` before `.email()` on all three schemas; `authorize` lookup → `findFirst({email:{equals, mode:"insensitive"}})` (legacy mixed-case rows keep working); register pre-check + updateProfile emailTaken also insensitive (Postgres unique is case-sensitive — without this, case-variant twins were possible). | `modules/accounts/schema.ts`, `modules/accounts/actions.ts`, `lib/auth.ts` |
| 4 | **L2 P2002 TOCTOU**: register `create` + updateProfile `update` wrapped — P2002 → same friendly field errors as the pre-checks (non-P2002 rethrown). Normalization guarantees racers collide on the same lowercase value so the unique index actually fires. | `modules/accounts/actions.ts` |
| 5 | **M4 logout bump**: `auth()` → `sessionVersion {increment:1}` → `signOut({redirectTo:"/"})` — bump precedes cookie clear (E2E proves copied cookie dies). | `modules/accounts/logout-action.ts` |
| 6 | **L11 honest message**: "✓ Password changed — please sign in again." + `Sign in again` link (no auto-redirect so the message is visible). | `components/storefront/ProfileForm.tsx` |
| 7 | **L4 requireAdmin redirects**: no session → `redirect("/login")`; not-admin/inactive/missing → `redirect("/")` (mirrors `proxy.ts` targets); still throws `NEXT_REDIRECT` — never a silent false; no more 500 error-boundary for routine cases. | `src/lib/require-admin.ts` |
| 8 | **L5 inline account guards**: `/account` + `/account/orders` redirect anon themselves (defense-in-depth over proxy; kills "Welcome back, undefined"). | `app/account/page.tsx`, `app/account/orders/page.tsx` |
| 9 | **L7 dead link removed**: `/account/shipping` card deleted from the account page (building the feature = new feature, still banned). | `app/account/page.tsx` |
| 10 | **M2 COD mark-paid guards**: pre-conditions (`paymentMethod=COD`, `orderStatus≠CANCELLED`, `paymentStatus=PENDING` with clear per-state messages) + **CAS** `updateMany({id, paymentStatus:"PENDING"})` count-0 → "reload and try again"; UI button only renders for `PENDING` + not-CANCELLED (was: any non-PAID). | `modules/admin/orders.ts`, `components/admin/AdminOrderRow.tsx` |
| 11 | **L3 toggle role guard**: select `role` too; target ≠ CUSTOMER → "Admin accounts cannot be disabled here." (list/detail already filter `role:CUSTOMER` — guard is server-side since actions are invokable by raw id). | `modules/admin/customers.ts` |
| 12 | **M1 retry ownership**: `retrySafepayPayment` (and via delegation `startSafepayRetry`) — account order → require owning session, else **identical "Order not found."** as a missing id (no existence oracle); guest order (`userId:null`) → cuid-bearer allowed (documented confirmation-page model). | `modules/orders/actions.ts` |
| 13 | **M5 `getOrderById` scoping**: same owner-or-bearer rule — user-owned + (no session OR mismatch) → `null` → page 404s; guest order → bearer cuid unchanged. | `modules/orders/queries.ts` |
| 14 | **L9 cart oracle**: missing item used to return `success:true` while a foreign item returned an error (crafted-id existence probe on BOTH update and remove) → both now return the identical `Item not found in your cart.`; foreign probe provably leaves the victim's line untouched (E2E). | `modules/cart/actions.ts` |

**Out of scope (unchanged):** L8 temp route (Phase 7), L10 admin UI result handling (Phase 6), shipping feature, per-device session allowlist (rejected), perf.

### 12.3 Tests added (45 new → total 147)
- `tests/unit/rate-limit.test.ts` (7): fresh key, exact exhaustion at 5, custom max, window expiry reopens + fresh count, reset-on-success, key isolation, prune removes only expired.
- `tests/unit/accounts-schema.test.ts` (4): trim+lowercase on login/register/updateProfile (pins Zod-v4 chain order), malformed still rejected.
- `tests/integration/account-actions.test.ts` (7): register stores lowercase; case-variant dup → friendly error + single row; P2002 race → same friendly error (pre-check mocked past); non-P2002 rethrown; updateProfile normalized write; case-variant taken refusal; update race → friendly.
- `tests/integration/logout-session-kill.test.ts` (3): bump happens **before** signOut (captured at call time); no-session still signs out; bystanders untouched.
- `tests/integration/mark-cod-guard.test.ts` (6): PENDING→PAID; PAID/REFUNDED/CANCELLED/non-COD/missing refused with state preserved; CAS count-0 path via read-then-flip.
- `tests/integration/toggle-admin-guard.test.ts` (3): customer toggles twice with version bumps; ADMIN target refused, untouched; unknown id.
- `tests/integration/retry-ownership.test.ts` (5): guest bearer OK; owner OK; stranger refused (tracker untouched, SDK not called); anon refused; unauthorized error **byte-identical** to missing id.
- `tests/integration/order-lookup-scope.test.ts` (5): guest bearer; owner sees; stranger null; anon+account null; unknown null.
- `tests/integration/require-admin.test.ts` (5): anon → redirect `/login`; ghost/disabled/customer → redirect `/` (asserted via caught `NEXT_REDIRECT` digest); active admin → session.
- Updated `tests/integration/account-guard.test.ts` expectation for the additive L6 fields.
- `vitest.integration.config.ts`: added `server.deps.inline: ["next-auth","@auth/core"]` (Phase 4 made `orders/actions.ts` import `@/lib/auth`; native ESM can't resolve next-auth's extensionless `next/server` — same fix the unit config already had).

### 12.4 Gate & manual verification
- `npm run test` → **147/147** (51 unit + 96 integration, 18 files); `tsc --noEmit` clean; `npm run lint` → **8 errors / 3 warnings** (= Phase 3 baseline, no regression); `prisma validate` ok; `prisma migrate status` up to date (7 migrations, none new); `npm run build` → 24 routes + proxy.
- **E2E on prod `next start :3100` → 66/66** (`/tmp/opencode/phase4-e2e.mjs`; action ids re-extracted from `server-reference-manifest.json` `exportedName`+`filename` every run): page regressions + proxy redirects (anon `/account*` → `/login`, `/admin` → `/`, anon admin action POST → 307 `/` — **`redirect:"manual"`, default fetch would follow and mask it**); L1 register/login/dup trio; M5 confirmation matrix (anon/stranger 404, owner 200, guest bearer 200); M1 retry matrix incl. live sandbox session + tracker-untouched on refusal; M4 copied-cookie dies on logout + version bump; L6 rename → session name updates live; L5 account page renders owner; L7 no link + signed-in `/account/shipping` → 404 (anon gets proxy 307 — must assert with session); M2 markCod all 4 refusals + success; L3 admin toggle refused/untouched, customer toggle works; M3 5 wrong pw then **correct pw still rejected** (account stays active); L11 changePassword kills session + new pw works + message shipped in client bundle; L9 foreign vs missing identical errors, victim line untouched.

### 12.5 Errors hit in Phase 4 & fixes
| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | `account-guard.test` `toEqual` failed (extra `name`/`email`) | L6 added fields to the select | updated expectation (documents the new contract) |
| 2 | Integration files: `Cannot find module '…/next/server' imported from next-auth/lib/env.js` (account-actions + the previously-green retry-payment) | `AuthError` import / new `@/lib/auth` import loads next-auth outside Vite; integration config lacked the inline-processing the unit config has | `server.deps.inline: ["next-auth","@auth/core"]` in `vitest.integration.config.ts` |
| 3 | tsc TS2339 `missing.error` on `RetryPaymentResult` | union not narrowed across statements in the E2E-mirror test | hoist `missingError` inside the narrowing branch |
| 4 | E2E: anon `/account/shipping` → 307, not 404 | proxy matcher fires first — masks the missing route | assert 404 with a **signed-in** session (proxy passes → real 404), keep the no-link check on the account page HTML |
| 5 | E2E: "anon admin action blocked" got 200 | `fetch` default `redirect:"follow"` → 307→GET `/`→200 | `redirect:"manual"` for that probe; assert 307/308 + location `/` |
| 6 | E2E: owner confirmation → 404 while probe → 200 | the owner GET in the script **omitted the `Cookie` header** (anonymous → correct 404) | added cookie header + explicit login-result checks; app code was correct (probe-proven) |
| 7 | E2E not re-runnable (register returns "already associated" on 2nd run) | users persist across runs; rate limiter is in-memory per process | delete `phase4%` users+orders between runs + restart server (fresh limiter) |

---

## 13. Phase 5 — cart & catalog — detailed log (what & why)

### 13.1 Fixes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | 8 local money formatters (some 0 dp, locale-dependent) + 2 inline `toLocaleString`s | one shared `formatPrice(paisa)` → always `Rs. 1,000.00` (2 dp, `en-PK`) | `src/lib/format.ts` (new) + 10 call sites |
| 2 | Quantity was trusted from the client (`Math.min(negative, stock)` could *inflate* stock at checkout) | `isValidQuantity` + `MAX_QUANTITY` (999) enforced in the action wrappers **before** `cookies()`/DB; core owns qty-0 (remove) and the stock-0 refusal; `cart.tsx` qty-0/`stock 0` never silently deletes | `cart/ops.ts`, `cart/actions.ts` |
| 3 | A variation an admin disabled (or that sold out) sat in the cart as a surprise checkout failure | `CartItemView.isEnabled` → **"Unavailable"** badge + disabled steppers; `updateVariation` now `revalidatePath("/cart")`; checkout names the exact line (`UnavailableVariationError.itemLabel` → `` `"<product> — <variation>" is no longer available…` ``) | `cart/types.ts`, `cart/page.tsx`, `admin/variations.ts`, `checkout/{pricing,place-order}.ts` |
| 4 | **H — guest cart never merged on login** (identity flips to `{userId}`, the guest cart is orphaned) | `mergeGuestCartCore` (transaction: sum quantities capped at 999, delete guest cart) + `mergeGuestCartForCurrentUser` (clears `girah_guest_id` **only after** a successful merge); wired into `login()`/`register()` | `cart/merge.ts` (new), `accounts/actions.ts` |
| 5 | `Number("8.3") * 100 = 830.0000000000001` → a Rs. 8.30 product silently vanished behind `minPrice=8.3` | `sanitizeFilters.toPaisa` — the single choke point rounds to integer paisa, drops non-finite/negative bounds | `catalog/queries.ts` |
| 6 | Nonsense `From Rs. 0` / `Rs. 0` price renders | `startingPrice === 0` → **Unavailable** (card); `lowestPrice === null` → Unavailable (buy panel) | `ProductCard.tsx`, `PurchasePanel.tsx` |
| 7 | Switching category/search silently dropped the price/stock filters | `CategoryTabs` clones the **full** query and swaps only `category`; the shop search form round-trips `minPrice`/`maxPrice`/`inStockOnly` as hidden inputs | `CategoryTabs.tsx`, `shop/page.tsx` |

### 13.2 Root cause: `login()` reported failure while the user *was* signed in

The Phase 5 E2E first run was **61/70 — all 9 failures were login/register merge checks** (login action not "success", `girah_guest_id` never cleared, guest cart never moved, merged line never visible).

Verified against the installed sources (not memory):

- `signIn()` (next-auth `lib/actions.js`) does `const cookieJar = await cookies(); cookieJar.set(c.name, …)` — `cookies()` in the **action phase** returns `MutableRequestCookiesAdapter.wrap(...)`, a *detached* `ResponseCookies` (incoming request cookies + this action's writes). Its values reach the browser via `appendMutableCookies`; they are **never** written back into the request headers (`synchronizeMutableCookies` only refreshes the read view — its own comment asks whether headers should be updated too).
- The no-arg `auth()` (`next-auth/lib/index.js`) runs `getSession(await headers(), config)`, which rebuilds `new Request(url, { headers: { cookie: headers.get("cookie") ?? "" } })` from the **incoming** request headers.
- ⇒ inside the action that just signed in, `auth()` always sees the pre-sign-in state → `session` null → `login()` returned `"Unable to sign in right now. Please try again."` **while a valid session cookie was already on its way to the browser**, and the merge was skipped (guest cookie left in place).
- Pre-existing since Phase 4 (`84f1b9a`, the C3 check) — not introduced by Phase 5. It survived because phase4-e2e logged in through `/api/auth/callback/credentials` (route handler, fresh request → headers intact) and `LoginForm` only calls `router.push("/account")` on success, so the false error was never asserted.

**Fix** — `src/lib/session.ts` → `readSessionFromCookieJar()`:

- reads the cookie jar **as it now stands** (mutable in the action phase) and replays it through Auth.js's own `handlers.GET` (`/api/auth/session`) via a `NextRequest` built from the real `x-forwarded-proto`/`host` — the exact pipeline `auth()` would run (jwt callback → expiry / `isActive` / `sessionVersion`, session callback → `user.id`), only with the cookies that exist instead of the stale request headers.
- **Fails closed:** no session cookie, a non-OK response (Auth.js reports config errors as 500s), or a body without `user.id` → `null` → the same C3 error. A test double for `@/lib/auth` (no `handlers`) short-circuits to `null` before touching `cookies()`, so existing mocks keep working.
- `login()` additionally requires `session.email === parsed.data.email` and `register()` requires `session.id === created.id` — a leftover session for a *different* account can never count as signing in (and can never trigger a merge).
- `updateProfile()`/`changePassword()` still use `auth()` — they run on a fresh request where the headers *do* carry the cookie.

### 13.3 Tests added (147 → **180**)

- `tests/unit/format-price.test.ts` (5) — `formatPrice` contract.
- `tests/integration/guest-cart-merge.test.ts` (6) — disjoint merge, quantity sum + 999 clamp, empty/stale/both-keys carts, cascade delete of the guest cart.
- `tests/integration/cart-qty-zero.test.ts` — qty-0 removes; stock-0 refuses with the friendly message and never touches the DB; foreign/missing item identical refusal.
- `tests/integration/cart-disabled-line.test.ts` — `isEnabled` view flag + cart query wiring.
- `tests/integration/catalog-filters.test.ts` — float-paisa rounding at the `sanitizeFilters` choke point.
- `tests/integration/login-session-proof.test.ts` (7) — drives `login()`/`register()` with a mocked cookie jar + mocked `handlers.GET`: happy path (replay + merge + cookie cleared), no cookie → handler never called, `{}` body, 500 body, wrong-account session, register merge + register stale-session guard.
- `pricing-guard.test.ts` +1 case for the named unavailable-line message.

### 13.4 Gate & E2E

- `npm run test` → **180/180** (56 unit + 124 integration, 30 files); `tsc --noEmit` clean; `npm run lint` → **8 errors / 3 warnings** (= baseline); `prisma validate` ok; `prisma migrate status` up to date (7 migrations, none new); `npm run build` → green.
- **E2E on prod `next start :3100` → 54/54** (`/tmp/opencode/phase5-e2e.mjs`): page regressions + anon proxy redirects; 2-dp money on shop/product/cart; float round trip (`minPrice=8.3` keeps the Rs. 8.30 product, drops Rs. 8.29), garbage bounds (`Infinity`/`NaN`) still 200 with the catalogue intact, search round trip, filter panel re-fill, category tabs carry the filters; **login merge** (action success, session cookie set, `girah_guest_id` cleared, guest cart gone, qty-2 line in the account cart, signed-in `/cart` renders it, 2-dp); **register merge** (same) + case-variant duplicate register still a friendly field error; disabled line badge + disabled steppers; checkout names `"Crochet Sunflower Bouquet — Full Floral Bouquet"`; negative/zero quantity refusals; stock-0 steppers disabled + friendly error with the line kept; qty-0 removes; zero-price card → "Unavailable" (never "From Rs. 0"); wrong-password generic error; admin credentials login + `/admin` 200.
- Fixtures are created and cleaned up inside the script (verified after the run: 0 `e2e-*` users/products/guest carts, dev-customer cart empty, seed stock restored).

### 13.5 Errors hit in Phase 5 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | 3 `webhook.test.ts` failures — `Hook timed out` inside `beforeEach → resetDb` (TRUNCATE) | transient Neon/network stall during a 500 s run; the file passes alone (16/16) and in the full re-run | re-ran the suite → 124/124; no code change |
| 2 | lint warnings 3 → 4 after the new test | unused `_req` param in the `vi.hoisted` stub | made `respond` 0-arg (the request is already inspected in the handler mock) |
| 3 | `/tmp/opencode/phase5-e2e.mjs`, `phase4-e2e.mjs`, `dbg-*.mjs` **gone** at session start | `/tmp` was wiped between sessions — the E2E scripts had never been committed | recreated `phase5-e2e.mjs` (54 checks); **`phase4-e2e.mjs` was not recreated** — its coverage now rests on the 124 integration tests plus the auth/redirect checks inside the new suite. Consider committing these scripts under `scripts/` in Phase 8. |
| 4 | E2E "garbage price params never render NaN" failed on a 200 | the assertion flagged the *echoed* `value="NaN"` hidden input (the user's own query string), not a broken render | narrowed it to `Rs. NaN` / `Rs. undefined` + "catalogue still listed" |
| 5 | `ERR_MODULE_NOT_FOUND: dotenv` when running the script from `/tmp` | ESM resolves bare specifiers relative to the *script*, not the cwd | `createRequire(project/package.json)` for all app dependencies |

---

## 14. Phase 6 — forms & admin feedback — detailed log (what & why)

### 14.1 Root cause: React 19 resets an `action={fn}` form *before* the action runs

Verified against the installed React 19.2.8 source (`node_modules/react-dom/cjs/react-dom-client.development.js`), not memory:

- Submit dispatch (~line 19080): when the form's `action` prop is a function, React does `event.preventDefault()` then `startHostTransition(formFiber, pendingState, action, formData)`.
- `startHostTransition` (~line 8940) runs `startTransition(…, function () { requestFormReset$1(formFiber); return action(formData); })` → **the reset is queued first**, so it commits whether the action succeeds or fails (flag `1024` → `fiber.stateNode.reset()` at commit, ~line 15152).
- Consequences found in the review (H finding): a failed login/register/checkout/product-save/stock-adjust **wiped everything the user had typed**, and `ProfileForm` reverted to the stale `defaultValue` even after a *successful* save.

### 14.2 Fixes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | 6 client forms submitted via `action={handleSubmit}` → auto-reset on every submit | `onSubmit` + `event.preventDefault()` + `new FormData(event.currentTarget)` read **synchronously** (before `startTransition` — `currentTarget` is null afterwards); rest of each handler untouched | `LoginForm`, `RegisterForm`, `ProfileForm` (×2 forms), `CheckoutForm`, admin `ProductForm`, admin `VariationRow` (adjust form) |
| 2 | `ProfileForm` cleared the password form with `document.getElementById("password-form")` | `useRef<HTMLFormElement>` + explicit `reset()` **only on success** (on failure the typed passwords now survive) | `ProfileForm.tsx` |
| 3 | `AdminOrderRow.handleStatusChange` ignored the result → an illegal jump (e.g. `CONFIRMED → PENDING`) left the select showing a status the DB refused | optimistic `setStatus`, then **revert to the previous status + `setError(result.error)`** on refusal; `handleMarkPaid` now surfaces its failure too | `AdminOrderRow.tsx` |
| 4 | `VariationRow.toggleEnabled` and `ToggleActiveButton` awaited their actions and dropped the result → silent no-ops | check `AdminActionResult`, render the error; `ToggleActiveButton` refreshes only on success | `VariationRow.tsx`, `ToggleActiveButton.tsx` |
| 5 | Error/success lines were plain text (one `role="status"` in the whole app) | `role="alert"` on every error `<p>` and `role="status"` on success lines **in the touched files only** | 6 forms + `AdminOrderRow` + `ToggleActiveButton` |

Design decision (user-approved): the admin status `<select>` still offers **all 6 statuses** — the server state machine stays the single source of truth, the refusal message (`` `Cannot move an order from ${from} to ${to}.` ``) is shown and the control reverts. Duplicating `ALLOWED_TRANSITIONS` in the client was rejected (it would go stale).

### 14.3 Out of scope (deliberately)

- Server-component `<form action={…}>` (cart steppers/remove, logout, Safepay retry): they take **no inputs**, so the auto-reset is a no-op — harmless. Their discarded failure results (e.g. a stock-race refusal on the cart stepper) are a separate gap, noted for Phase 7/8.
- `src/app/test-payment-guard/page.tsx` (one of the 8 baseline lint errors) — deleted in Phase 7.

### 14.4 Tests added (180 → **210**)

`tests/unit/client-forms-guard.test.ts` (**30**, zero new dependencies — the repo has no jsdom/Playwright, so the DOM behaviour itself is checked by the manual checklist in §14.5):

- 6 files × 3 assertions: no `<form … action={` · has `<form … onSubmit={` · `event.preventDefault()` + `new FormData(event.currentTarget)`.
- 8 files: errors carry `role="alert"`; `ProfileForm` success carries `role="status"`.
- 3 admin components: surface a refused `AdminActionResult` (`result.success` + `setError`).

### 14.5 Gate & verification

- `npm run test` → **210/210** (86 unit + 124 integration, 31 files); `tsc --noEmit` clean; `npm run lint` → **8 errors / 3 warnings** (= baseline, untouched); `prisma validate` ok; `prisma migrate status` up to date (7 migrations, none new — Phase 6 touches no server code); `npm run build` → green.
- **E2E on prod `next start :3100` → 58/58** (`/tmp/opencode/phase5-e2e.mjs`): the previous 54 checks plus 4 new Phase 6 wire checks — `updateOrderStatus` action id resolves, a `CONFIRMED` order exists, `CONFIRMED → PENDING` is refused over HTTP with `success:false` + `Cannot move an order from …`, and the order row is untouched afterwards.
- **Page smoke → 8/8** (`/tmp/opencode/phase6-smoke.mjs`): `/login`, `/register`, `/admin/orders`, `/admin/variations`, `/admin/products/new`, `/admin/customers`, `/account`, `/checkout` (with a temporary cart line, cleaned up) all render 200 with no application error.
- **Manual browser checklist** (agreed verification for DOM behaviour — needs a human; server left running on `:3100`, log `/tmp/opencode/phase6-server.log`): 1) `/login` wrong password → alert + email/password still typed · 2) `/register` duplicate email → field alerts, values kept · 3) profile save → "✓ Profile updated" **and the name field shows the new value** · 4) profile failure → values kept · 5) wrong current password → alert, three password fields kept · 6) password success → cleared + "sign in again" · 7) checkout server-validation failure → address block kept · 8) admin product duplicate slug → fields kept · 9) orders `PENDING → SHIPPED` (illegal) → select reverts + refusal message · 10) `PENDING → CONFIRMED` applies · 11) variations "Disable" flips the label without a manual refresh · 12) customers "Disable Account" flips the button.

### 14.6 Decisions recorded (user)

1. Verification = **static guard test + manual browser checklist** (jsdom/`@testing-library` and Playwright both declined — Playwright reconsidered in Phase 8).
2. A11y `role="alert"` / `role="status"` → **touched files only**, no app-wide sweep.
3. Admin status select → **all options + error/revert**, server remains source of truth.

---

## 15. Phase 7 — hygiene — detailed log (what & why)

Phases 1–6 complete (§4, §10–§14); this phase only removes debt and adds missing shell pages — **no behaviour changes beyond the approved Header/callbackUrl work**.

### 15.1 Scope decisions (user-confirmed)

1. **Header scoping**: storefront `Header` mounts in `(storefront)`, `(auth)` and `account` layouts — **admin gets none**.
2. **Prisma**: drop the deprecated `previewFeatures = ["driverAdapters"]` **only**; the unused `Review` / `ProductImage` tables stay (no migration).
3. **404 / error / loading**: full set of special files.
4. **Dates**: one shared formatter pinned to **`Asia/Karachi`**.
5. **Docs**: the 24 refs to the never-committed `girah.md` / `implementation-plan.md` / `technical-design.md` are **retargeted (dead citation dropped, reasoning kept)** + a real **README rewrite** (the file was stock create-next-app boilerplate).

### 15.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | 8 lint errors / 3 warnings (baseline) | `test-payment-guard` route deleted; `logout` moved into the `accounts` module (was its own file under `src/app/…`) so `@/modules/*/*` can't be imported from a client component; 4 admin components import from the `@/modules/admin` barrel; `FilterPanel` ternary-as-statement → `if/else`; `&apos;` escapes; lint message now points at §8 | `eslint.config.mjs`, `src/app/`, `src/modules/accounts/actions.ts`, 4 `src/components/admin/*`, `FilterPanel.tsx`, `LoginForm.tsx`, `account/orders/page.tsx` |
| 2 | Empty barrels/stubs left from earlier phases | `src/modules/reviews/index.ts` deleted; 6 empty dirs removed (`about/`, `contact/`, `faq/`, `account/shipping/`, `components/ui/`, `emails/`) — `find src -type d -empty` is clean | `src/` |
| 3 | Login success always went to `/`; anon `/admin` and `/account` bounced to `/` (dropping the destination) | `safeCallbackUrl()` (same-origin only: must start `/`, no `//`, no `\`, no `..`, ≤512 chars, no control chars) + `proxy.ts` `loginUrl()` sets `callbackUrl=pathname+search`; anon `/admin` → login-with-callback, **logged-in non-admin `/admin` → `/`** (else a customer would loop back to `/admin` after login); `LoginForm` takes `callbackUrl` and `router.push(safeCallbackUrl(...))` | `src/lib/callback-url.ts` **(new)**, `src/proxy.ts`, `LoginForm.tsx`, `(auth)/login/page.tsx`, `account/page.tsx` |
| 4 | `Header` (Cart badge + Sign In) rendered inside the **root** layout → `/admin` showed storefront chrome | root layout renders only `{children}`; `page.tsx` moved (`git mv`) into `(storefront)/`; three tiny layouts each render `<Header />{children}` | `src/app/layout.tsx`, `(storefront)/layout.tsx`, `(auth)/layout.tsx`, `account/layout.tsx` |
| 5 | No loading/404/error pages anywhere (soft 404s were plain Next defaults; a thrown error 500'd with no UI) | `RouteSkeleton` (`role="status"`) + `NotFoundView`; `loading.tsx` at root, `(storefront)`, `account`, `admin` (`contained={false}` — the admin layout supplies the container); `not-found.tsx` at root + `(storefront)`; `error.tsx` (Next 16 props are `{error, retry}` — **not** `reset`); `global-error.tsx` (own `<html><body>`, inline palette since `globals.css` isn't loaded) | 8 special files + `src/components/shared/{RouteSkeleton,NotFoundView}.tsx` |
| 6 | `toLocaleDateString()` → different calendar day on a UTC host than a PK visitor (19:30Z = 00:30 PK next day) | `formatDate()` (en-GB, `timeZone: "Asia/Karachi"`, `26 Sept 2026`); the 2 call sites use it | `src/lib/format.ts`, `account/orders/[id]/page.tsx`, `admin/customers/[id]/page.tsx` |
| 7 | Deprecated Prisma preview flag | `previewFeatures` removed; `prisma validate`/`generate` clean (warning gone); **7 migrations unchanged** | `prisma/schema.prisma` |
| 8 | 24 refs to docs that don't exist in the repo; README was create-next-app boilerplate | dead citations dropped (reasoning kept — §8); README rewritten: stack, env setup, migrate+seed, scripts, test accounts, layout, conventions, status | 14 source files + `README.md` |

### 15.3 The soft-404 trade-off (read before changing loading pages in Phase 8)

Verified empirically on the production build, and documented by Next itself (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`):

> "The trade-off is the HTTP status code. Because the check runs inside the `<Suspense>` boundary, the response has already begun streaming as a `200`, and the status can't change once streaming has started. The `noindex` tag keeps a soft 404 out of search results."

| Setup | `/product/<missing>` status |
|-------|----------------------------|
| root `loading.tsx` only | **200** |
| `(storefront)/loading.tsx` only | **200** |
| neither | 404 |
| `/definitely-missing` (no page to stream) | **404** (always) |

- Any `loading.tsx` at or above the page makes `notFound()` render **our** 404 view with HTTP 200. Tried `generateMetadata()` + `notFound()` on the product and confirmation pages to beat it — **still 200**, so both were reverted (keeping them would also have been a new feature: per-product `<title>`).
- **Accepted**: the skeleton set stays; streamed soft-404s are noindexed (asserted in E2E: `<meta name="robots" content="noindex">` present). If a real 404 status ever matters, the options are: drop the affected `loading.tsx`, or do the existence check in `proxy` (DB call in middleware — not done here).
- `noindex` is emitted by Next for `notFound()` **and** for the route-level 404 page, so nothing gets indexed twice.

### 15.4 Tests added (210 → **243**)

- `tests/unit/format-date.test.ts` (**4**): PK-midnight boundary (`2026-09-25T19:30Z` → `26 Sept 2026`; `18:59Z` vs `19:00Z`), format shape, month coverage. (en-GB renders September as **`Sept`**, everything else 3 letters — asserted as-is.)
- `tests/unit/callback-url.test.ts` (**9**): open-redirect vectors `//evil.com`, `https://…`, `javascript:`, `/\evil`, `..`, control chars, empty/oversized/non-string → fallback `/account`; valid paths + custom fallback pass.
- `tests/unit/app-shell.test.ts` (**20**): root layout has no `Header`, the 3 layouts render it, admin doesn't; all 8 special files exist; `error.tsx` uses `retry` (not `reset`); `global-error` has `<html>/<body>`; not-found views use `NotFoundView`; `test-payment-guard` + `logout-action.ts` gone; homepage in `(storefront)`; **no `toLocaleDateString` anywhere under `src/`**.

### 15.5 Gate & verification

- `npm run test` → **243/243** (119 unit / 11 files + 124 integration / 23 files); `tsc --noEmit` clean; **`npm run lint` → 0 errors / 0 warnings** (from 8/3 — target met); `prisma validate` + `migrate status` ok (7 migrations, none new); `npm run build` green.
- **E2E on prod `next start :3100` → 68/68** (`/tmp/opencode/phase5-e2e.mjs`): the 58 Phase-5/6 checks (one retargeted: anon `/admin` now expects `/login?callbackUrl=%2Fadmin`) plus 10 new — anon `/admin/products` and `/account/orders` bounce with the right `callbackUrl`; `/definitely-missing` → real 404 + our view; `/product/<missing>` → our view + `noindex`; `/admin` (signed in) has **no** `href="/cart"` while `/`, `/login`, `/account/orders` do.
- **Page smoke → 8/8** (`/tmp/opencode/phase6-smoke.mjs`).
- **Manual browser checklist** (needs a human; server left running on `:3100`, log `/tmp/opencode/phase7-server.log`): 1) `/admin` as admin — no Cart/Sign In chrome, sidebar intact · 2) `/` and `/shop` still show the header + Cart · 3) signed out → `/admin/products` lands on `/login?callbackUrl=%2Fadmin%2Fproducts`, log in → back on that page · 4) signed out → `/account/orders` → login → returns to `/account/orders` · 5) unknown URL → our 404 page (Go Home / Continue Shopping) · 6) slow navigation shows the skeleton (no layout jump) · 7) `/admin/customers/<id>` shows `Joined 26 Sept 2026`-style dates · 8) `/product/<missing>` shows our 404 view · 9) force an error (throw in a page) → error page with working "Try Again".

### 15.6 Errors hit in Phase 7 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | `tsc` failed on `.next/types/validator.ts` referencing deleted `src/app/page.js` / `test-payment-guard/page.js` | stale generated types after `git mv` + route deletion | `rm -rf .next` (rebuild regenerates) |
| 2 | `formatDate` tests expected `26 Sep 2026`, got `26 Sept 2026` | en-GB CLDR abbreviates September as `Sept` (stable across ICU versions) | expectations + comment updated; boundary test moved to October (`26 Oct/27 Oct`) |
| 3 | `app-shell` "no `toLocaleDateString`" test threw `ENOENT … 'rc/app/(auth)/layout.tsx'` | `ROOT` from `new URL("../..")` already ends in `/`, so `slice(ROOT.length + 1)` ate a char | `path.relative()` for the reported path |
| 4 | `npx vitest --config vitest.unit.config.ts` → unresolved entry | unit config is `vitest.config.ts` (no `vitest.unit.config.ts`) | use `vitest.config.ts` |
| 5 | E2E check `anon GET /admin → /` failed | Phase 7 deliberately changes it to login-with-callback | assertion retargeted to `/login?callbackUrl=%2Fadmin` |
| 6 | `/product/<missing>` was 404 before Phase 7, 200 after | streaming trade-off (§15.3) — first suspected `generateMetadata` could fix it | documented + `noindex` asserted; `generateMetadata` experiments reverted |
| 7 | `/tmp/opencode/*.mjs` scripts (E2E, smoke) are not in git | `/tmp` is wiped between sessions (same as §13.5 #3) | recreate each time; **Phase 8 should commit them under `scripts/`** |


---

## 16. Phase 8 — test automation & CI — detailed log (what & why)

### 16.1 Scope decisions (user-confirmed before execution)

| # | Question | Decision |
|---|----------|----------|
| 1 | CI database | **Neon via GitHub secrets** (`DATABASE_URL` + a dedicated `DATABASE_URL_TEST`). No local `postgres` service container: `@prisma/adapter-neon` is WebSocket/Neon-only — swapping drivers for CI was explicitly rejected. |
| 2 | Browser E2E | **No Playwright.** Commit the existing HTTP E2E/smoke scripts into `scripts/` and run them in CI instead. |
| 3 | Functional gaps | **Fix the cart-stepper silent failure** — the only functional change in this phase. |
| 4 | Coverage tooling | **No** coverage tooling. |

### 16.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | Cart steppers ignored `CartActionResult` — an admin-refused / stock-refused change looked like a success (steppers revert silently) | New `"use client"` `CartLineControls` with `useActionState` over hidden `op` inputs (`inc\|dec\|remove`); refusal renders `role="alert"`. Inline `"use server"` closures removed from the cart page (map → expression form). DOM/aria/disabled rules unchanged so the E2E `stepperDisabled()`/`lineBlock()` checks still pass. | `src/components/storefront/CartLineControls.tsx`, `src/app/(storefront)/cart/page.tsx` |
| 2 | Guard against a silent re-regression | Unit test asserts the refusal path renders the alert, the success path doesn't, and `op` values are the only dispatch | `tests/unit/cart-line-controls.test.ts` (**6**) |
| 3 | E2E + smoke lived only in `/tmp/opencode/` — wiped between sessions (lost once, already recreated 3×) | Committed as `scripts/e2e.mjs` + `scripts/smoke.mjs`; `npm run test:e2e` / `npm run test:smoke`. `ROOT` derived from `import.meta.url`; `E2E_BASE_URL` (default `http://localhost:3100`) instead of a hardcoded origin. | `scripts/`, `package.json` |
| 4 | Both suites were **dev-DB-state dependent**: hardcoded variation ids (`V_SMALL`…), an existing `CONFIRMED` order, seed product slugs, and `category.findFirst()` (null → crash on an empty DB) | Fully self-provisioning: `fixtureProduct()` creates product + 3 variations (named like the seed's) in a created-or-reused category; `probeOrder()` creates the order to probe the illegal transition; smoke gained `ensureUser()` (the 2 known test accounts) + a fixture variation when unseeded. Assertions retargeted to the fixture's names/slugs. | `scripts/e2e.mjs`, `scripts/smoke.mjs` |
| 5 | No CI at all | `.github/workflows/ci.yml`: secrets guard → `npm ci` → `prisma generate` + `validate` → lint 0/0 → `tsc` → unit → integration → build → boot `next start` on the **test** DB → smoke → E2E. Concurrency cancel + `permissions: contents: read` + 25-min timeout. | `.github/workflows/ci.yml` |
| 6 | Stale comments / docs | `require-admin.ts` "starting in Phase 8" reworded; README got **E2E**, **CI** and `scripts/` sections; §2 rows 2–8 marked ✅; §9 rewritten. | `src/lib/require-admin.ts`, `README.md`, this file |

### 16.3 Fresh-database proof (why #4 mattered)

The whole point of making the scripts self-contained: created a scratch Neon DB `girah_e2efresh` (migrations only, **never seeded**), built, ran `next start` against it → **smoke 8/8 + E2E 68/68 on an empty database**, then verified leftovers: `products 0, orders 0, carts 0` (only the 2 ensured accounts + a fixture category). Scratch DB dropped afterwards. Both suites also re-run green against the dev DB (final gate).

### 16.4 CI design & the secrets you must add

- **Required repository secrets** (Settings → Secrets → Actions — the agent cannot create them, so CI stays red until they exist):
  - `DATABASE_URL` — main Neon URL (only used to *locate* the test DB; tests never write to it)
  - `DATABASE_URL_TEST` — isolated DB for integration tests + E2E, e.g. `…/girah_ci`
- Everything else is an **inline non-secret stand-in** mirroring `.env.example` (`AUTH_SECRET`, `NEXT_PUBLIC_APP_URL=http://localhost:3100`, `SAFEPAY_*`, `CLOUDINARY_*`, `RESEND_API_KEY`) — no real credentials in CI.
- `npx prisma generate` is an explicit step (package.json has no postinstall).
- A **secrets guard** fails fast with an actionable error rather than silently running E2E against the main DB.
- Integration tests resolve the test DB from `DATABASE_URL_TEST` (`tests/setup/env.ts`); the global setup runs `prisma migrate deploy` against it — CI never migrates dev.
- **Risk flagged:** `@prisma/adapter-neon` needs WebSocket egress to Neon from GitHub runners. If that is blocked, the fallback is lint/tsc/unit/build-only CI (flagged to the user; no adapter swap planned).

### 16.5 Tests & gate

- Unit **119 → 125** (new `cart-line-controls`, 6); integration unchanged **124**; total **243 → 249**.
- Gate: `npm run test` **249/249** · `tsc --noEmit` clean · **`npm run lint` 0 errors / 0 warnings** · `prisma validate` + `migrate status` (7 migrations, none new) · `npm run build` green · **smoke 8/8 + E2E 68/68** on both the fresh and the dev database · **CI workflow validated** (YAML parse OK).

### 16.6 Errors hit in Phase 8 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | Throwaway `echo "target db: $(node -e "new URL(process.argv[1])")"` → `TypeError: Invalid URL`, and `migrate deploy` then ran without my explicit env | `process.argv[1]` was never passed to that inline node call; the empty `DATABASE_URL` made Prisma fall back to `.env` | Verified afterwards that the scratch URL/migrations were actually correct (the error was cosmetic — my debug echo, not the pipeline); dropped the throwaway line |
| 2 | `prisma db execute` with a `SELECT` → "Either --url or --schema must be provided" | I passed `DATABASE_URL` via env instead of `--url` (execute doesn't read it) | Used `--url` / skipped the probe — migration status already proved the schema |
| 3 | **First CI run failed at `tsc`: `LayoutProps` not found** in `src/app/layout.tsx` | `LayoutProps`/`PageProps` are globals Next emits into `.next/types` (tsconfig includes it) — a clean checkout has no `.next`, while every local gate ran on top of an existing build | CI now runs `npx next typegen` before `tsc` (verified from a clean state: `mv .next` → typegen → tsc green). README notes the same |

### 16.7 Decisions recorded

- **Soft-404 trade-off stands** (§15.3): E2E asserts `noindex` instead of a 404 status on streamed pages.
- **Playwright**: declined by user decision — the HTTP suites (68 checks, no browser deps, run in CI) are the accepted automation layer.
- **Coverage**: explicitly declined; test counts in §2 are the measure.
- **Cart stepper pattern**: `useActionState` + hidden `op` inputs + `role="alert"` is now the repo convention for client-dispatched action feedback (documented in §8-adjacent README conventions).


---

## 17. Phase 9 — storefront shell — detailed log (what & why)

First feature phase (feature plan §2). The fix plan ended at Phase 8; this phase only **adds UI** — no schema changes, no new dependencies, no behaviour changes to existing flows.

### 17.1 Decisions (user-confirmed umbrella + per-phase defaults D1–D5)

- Umbrella: storefront-first · Resend emails later · hand-rolled charts · extras = wishlist + site search.
- **D1** Footer in the three Header layouts (`(storefront)`, `(auth)`, `account`) — never admin (E2E asserts `/admin` has no `href="/cart"`; footer must not leak either).
- **D2** Breadcrumbs on storefront + account only; admin keeps its sidebar.
- **D3** Hero is text + brand-color panels — no photo (`public/` had only create-next-app svgs; photography is a content task).
- **D4** **No DB query in Header** — header stays static (wordmark, Shop, search, Account/Sign In, Cart, hamburger). Category discovery lives in the footer, homepage strip and `/shop` tabs.
- **D5** Footer links = existing routes only. About/FAQ/Contact/legal pages do not exist and are **not** linked (a unit test enforces a dead-link whitelist).

### 17.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | Homepage was untouched create-next-app boilerplate ("Deploy Now", `next.svg`, dark-mode template) | Real data-driven homepage: hero → category strip (hidden when empty) → featured grid (first 6 of `getProducts`, using `ProductCard`'s existing `number` prop) → trust strip → story band; empty-DB fallback copy | `src/app/(storefront)/page.tsx` (69 boilerplate lines replaced) |
| 2 | `Header` was a "MINIMAL SCAFFOLD" (logo + Account + Cart only), no search, no mobile nav | Rewritten: desktop nav + GET search form → `/shop` + auth link + `CartBadge` + hamburger; new client `MobileMenu` drawer (search form, links, `aria-expanded`/`aria-controls`, Escape closes) | `src/components/shared/Header.tsx`, `MobileMenu.tsx` |
| 3 | **No footer anywhere** in the app | New async `Footer` (brand blurb, shop + category links from `getCategories()`, account links, trust line, ©) mounted in the 3 layouts, which now wrap children in `<main className="flex-1">` (body is already `flex flex-col`, so the footer sticks to the bottom) | `src/components/shared/Footer.tsx` + 3 layouts |
| 4 | No breadcrumbs | Accessible `Breadcrumbs` (`nav[aria-label]`, `aria-current="page"` on the last crumb) on `/shop`, `/product/[slug]` (with category), `/account`, `/account/orders`, `/account/orders/[id]`, `/account/profile` | `src/components/shared/Breadcrumbs.tsx` + 6 pages |
| 5 | No shared UI primitives — every page repeats raw class strings | `src/components/ui/{Button,ButtonLink,Input,Field}.tsx` on the design tokens (`--radius-control`, `bg-sage`, `border-border`, …). **Only Phase 9 UI uses them for now** — migrating old call sites is Phase 16 | `src/components/ui/` |
| 6 | create-next-app assets in `public/` | `next/vercel/file/globe/window.svg` deleted (only the boilerplate homepage referenced them) | `public/` |

### 17.3 Empty-database proof (homepage must survive CI's unseeded test DB)

Scratch Neon DB `girah_p9fresh` (migrated, never seeded) + `next start -p 3101`: `/` → **200**, featured grid renders the "being restocked" fallback, category strip correctly hidden, `<footer>` present, hero CTA present, `/shop` + `/login` → 200. Scratch DB dropped afterwards; build output confirms `/` is `ƒ (Dynamic)` (no build-time data baked in).

### 17.4 Tests & gate

- Unit **125 → 151** (new `tests/unit/storefront-shell.test.ts`, **26**): homepage not boilerplate + data-driven, svgs deleted, Header search/mobile-menu wiring, footer in 3 layouts and absent in admin, **dead-link whitelist**, breadcrumb accessibility + presence on 6 pages, primitives exist and use tokens (incl. the `Omit<…, "size">` guard).
- Smoke **8 → 9 pages** (`GET /` added). E2E **68 → 76 checks**: no boilerplate on `/`, hero → `/shop`, footer on `/` + `/login` + `/account/orders`, **no footer in `/admin`**, header search form, breadcrumbs on `/shop`.
- Gate: `npm run test` **275/275** (151 unit / 13 files + 124 integration / 23 files) · `tsc --noEmit` clean · `npm run lint` **0 errors / 0 warnings** · `prisma validate` + `migrate status` (7, none new) · `npm run build` green · **smoke 9/9 + E2E 76/76** on dev DB · fresh-DB proof (§17.3).

### 17.5 Manual browser checklist (needs a human; server on `:3100`, log `/tmp/opencode/phase9-server.log`)

1) Desktop header shows wordmark + Shop + search box + Account + Cart · 2) search box submits → `/shop?search=…` results · 3) at ≤640px the hamburger opens the drawer (search + links), Escape/close button dismisses it · 4) footer renders on `/`, `/shop`, `/login`, `/account` but **not** `/admin` · 5) footer category links filter `/shop` · 6) homepage shows hero + featured products + trust strip + story band · 7) breadcrumbs on `/shop` and a product page (category crumb filters correctly) · 8) account pages show Home / Account / … crumbs.

### 17.6 Errors hit in Phase 9 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | `tsc`: `Input.tsx(15): Type '"md"' is not assignable to type 'never'` (+ call-site errors in Header/MobileMenu) | intersecting my `size?: "md"\|"sm"` with React's numeric `size` on `InputHTMLAttributes` → `never` | `Omit<InputHTMLAttributes<HTMLInputElement>, "size">` — asserted by the unit test |
| 2 | `tsc`/lint: `ButtonLink` imported the deleted `ButtonLinkProps` | I removed that stray type from `Button.tsx` in the same batch I created it | import trimmed to `buttonClassName` + variant/size types |
| 3 | Dead-link unit test failed: 0 hrefs found | Footer routes live in `href: "/shop"` const arrays and flow through `<FooterLink>` — there are no literal `href="…"` attributes to match | regex now matches both `href="…"` and `href: "…"` |
| 4 | A multi-step shell block returned "(no output)" mid-phase | tooling/quoting noise in a throwaway `set -e` block — the same steps all worked when run individually | re-ran stepwise; no code impact |

### 17.7 Decisions recorded

- Primitives are **additive**: existing forms/pages keep their inline classes until Phase 16 (avoids touching Phase 1–6 verified behaviour).
- `Field` ships unused-by-pages on purpose (Phase 12/14 forms adopt it); the unit test keeps it honest.
- Homepage `metadata` untouched (root title/description apply); no per-page `<title>` experiments (Phase 7 lesson).

---

## 18. Phase 10 — reviews & recommendations — detailed log (what & why)

The `Review` model (schema + migration 1) existed with **zero UI and zero writers**. This phase adds the whole loop: buyer submits → moderation → storefront display, plus card ratings and related products.

### 18.1 Decisions (user-confirmed before execution)

- **Verified buyers only**: ≥1 **non-CANCELLED** order containing any variation of the product. The gate is checked twice — once to decide whether the form renders (`getReviewSubmissionState`) and again inside `submitReview` (never trust the hidden `productId` a client posted).
- **One review per user per product**: DB `@@unique([productId, userId])` + `upsert`. Resubmitting (even an already-approved review) updates the same row and **resets it to PENDING** — an edit goes back through moderation.
- **Reviewer privacy**: storefront shows first name + last initial (`Ayesha Khan` → `Ayesha K.`), "Anonymous" when the account has no name. Admin moderation shows the full name + email (moderators need to identify the account).
- **Ratings on cards too**: `getProducts` now returns `ratingAverage`/`ratingCount` (APPROVED only), so `/shop` and the homepage featured grid render a star line automatically.

### 18.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | Nothing stopped two reviews from one user per product | Migration 8 `20260926081401_phase10_review_unique` — `CREATE UNIQUE INDEX "Review_productId_userId_key"` | `prisma/migrations/…` (created **manually**: `migrate dev` refuses non-interactive shells here and `script -qec` hung; applied with `migrate deploy` + `prisma generate`) |
| 2 | Review submission/domain had no module | New `src/modules/reviews/`: `types.ts`, `format.ts` (`formatReviewerName`), `queries.ts` (`getProductReviewsAndRating` APPROVED-only + avg/count + `isMine`, `hasVerifiedPurchase`, `getReviewSubmissionState`), `actions.ts` (`submitReview`: validate-first → auth → product exists → purchase gate → `upsert` → `revalidatePath(/product/<slug>)`), barrel `index.ts` | `src/modules/reviews/` |
| 3 | `ProductListItem` had no rating | `ratingAverage`/`ratingCount` added to the type; `getProducts` includes APPROVED reviews and computes the fields in the existing map (no extra query) | `src/modules/catalog/{types,queries}.ts` |
| 4 | No star line on product cards | Renders `★ 4.8 (12)` **only when `ratingCount > 0`** with a descriptive `aria-label` (never a fake 0.0) | `src/components/storefront/ProductCard.tsx` |
| 5 | Product page ended at the purchase panel | New `Reviews` section: average summary, sign-in prompt (anon) / "Only verified buyers…" (non-buyer) / form (buyer), APPROVED review list (`(You)` tag, `formatDate`), plus "You may also like" — same category, self excluded, take 4 | `src/app/(storefront)/product/[slug]/page.tsx` |
| 6 | No form or star renderer | `ReviewForm` (client, `useActionState`, star radios + textarea, success → `role="status"` "awaiting approval", errors via `Field` → `role="alert"`) and `RatingStars` (text stars, sr-only label) | `src/components/storefront/{ReviewForm,RatingStars}.tsx` |
| 7 | `/admin/reviews` was a 3-line stub | Real page: status tabs (`?status=PENDING\|APPROVED\|REJECTED`), newest-first list; `getAdminReviews`/`setReviewStatus` (`requireAdmin` first, validates status, `revalidatePath` product page + queue) | `src/app/admin/reviews/page.tsx`, `src/modules/admin/reviews.ts` (+ barrel), `src/components/admin/ReviewRow.tsx` (client, Approve/Reject, `role="alert"`) |

### 18.3 Behaviour worth knowing before touching this code

- Visibility rule: **APPROVED only**, everywhere on the storefront (product page, rating average, card stars). PENDING/REJECTED never leak — enforced in `queries.ts`/`catalog/queries.ts` and asserted in unit + E2E.
- `hasVerifiedPurchase` ignores `CANCELLED` orders; a signed-in non-buyer gets a friendly refusal, not an error page.
- A REJECTED author may resubmit (the upsert resets status to PENDING). The form stays rendered for buyers regardless of status, with a status note above it.
- `setReviewStatus` revalidates the **product page** (approved → visible, rejected → withdrawn) and the queue.

### 18.4 Tests & gate

- Unit **151 → 166** (new `tests/unit/reviews.test.ts`, **15**): `formatReviewerName` table (6 cases) + source guards — product page wiring, APPROVED-only queries, purchase gate + upsert in the action, form feedback channels, card star guard, rating type fields, admin page no longer a stub, `requireAdmin` in both admin entry points, moderation `role="alert"`.
- Integration **124 → 142** (new `tests/integration/reviews.test.ts`, **18**): anon/non-buyer/cancelled-order refusals, buyer → PENDING row, validate-first (rating/text/missing product), one-row-per-user resubmit reset, submission-state matrix (anon/buyer/non-buyer), APPROVED-only visibility + averages + `(You)` + name masking, admin list/filter/approve/reject/status validation, both admin entry points reject when `requireAdmin` throws.
- Smoke **9 → 10 pages** (`GET /admin/reviews` as admin). E2E **76 → 108 checks** (new section 14: action-id resolution, anon prompt + refusal, non-buyer refusal, buyer success → PENDING, pending never rendered (incl. no star summary), moderation queue + anon redirect, approve → public + summary `aria-label` + `(You)` + shop-card star line, resubmit keeps 1 row and re-hides, reject → public/author both hide, status tabs).
- Gate: `npm run test` **308/308** (166 unit / 14 files + 142 integration / 24 files) · `tsc --noEmit` clean · `npm run lint` **0/0** · `prisma validate` + `migrate status` (**8**, none pending) · `npm run build` green (with `/admin/reviews` as a real route) · **smoke 10/10 + E2E 108/108** on the dev DB · post-run leftover query confirmed **0** e2e products, 0 `GIR-REV*` orders, 0 fixture reviews.

### 18.5 Manual browser checklist (needs a human; server on `:3100`)

1) As an **anonymous** visitor the product page shows "Sign in to review this product", no form, no stars · 2) sign in as an account that **never bought** the product → "Only verified buyers can review this item" · 3) sign in as a buyer → the form appears (star radios turn gold on select, textarea pre-fills your previous text if you have one) · 4) submit → green "Thanks — your review is awaiting approval" + the amber "awaiting approval" note on reload · 5) approve it in `/admin/reviews` → the product page now shows your review with stars, "(You)" and the `4.8 (1)` summary; `/shop` shows the star line on that card · 6) edit + resubmit → back to "awaiting approval", still **one** review in the admin queue · 7) reject it → it disappears from the product page (form still lets you submit again) · 8) "You may also like" lists same-category products excluding the current one.

### 18.6 Errors hit in Phase 10 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | vitest `[PARSE_ERROR] Unexpected flag l in regular expression literal` in the unit test | `/from "@/modules\/reviews"/` — the `/` after `@` closed the regex literal, leaving `modules…` as flags | replaced regex matchers with `toContain("…")` string assertions |
| 2 | `TypeError: submitReview is not a function` in the integration suite | the action lives in `reviews/actions.ts` (a `"use server"` file) and is intentionally **not** re-exported by the barrel (actions are imported via `@/modules/<name>/actions`) | import `submitReview` from `@/modules/reviews/actions`; queries keep coming from the barrel |
| 3 | E2E: 3× "pending/rejected text leaked" even though the review list was correct | the author's own text **legitimately** appears in (a) the RSC flight payload — `existing.text` is a client-component prop inside inline `<script>`s — and (b) the `<textarea>`'s pre-filled value; neither is a rendered review | new `visibleHtml()` helper strips `<script>` + `<textarea>` before visibility assertions (first attempt only stripped textareas — confirmed by probing the page HTML with a throwaway script) |
| 4 | `prisma migrate dev` hangs waiting for an interactive prompt; `script -qec` also hung | shell has no usable TTY for Prisma's safety prompt | write the migration folder by hand (Prisma-identical SQL) → `npx prisma migrate deploy` → `npx prisma generate` (same approach as migration 7/8) |

### 18.7 Decisions recorded

- Moderation is **in-row** (`useTransition` on Approve/Reject), not a separate detail page — there are only 100 reviews max in the list (`take: 100`, newest first; pagination lands with Phase 13 dashboards).
- `ReviewRow` keeps local `status` state for instant feedback; the server result is authoritative and failures render inline (`role="alert"`) without a page reload.
- Star rendering is text (`★`/`☆`) — no icon dependency, consistent with the "no new dependencies" rule; `RatingStars` owns the sr-only label so cards and the page summary can't drift apart.
- `formatReviewerName` is exported from the barrel so unit tests cover the privacy rule directly (and admin never uses it — moderation shows the full account name).

---

## 19. Phase 11 — admin catalog completeness — detailed log (what & why)

Product CRUD and variation *edit* existed; this phase made the catalog fully manageable: **image uploads** (nothing ever touched `ProductImage` from admin), **variation create**, **category CRUD**, plus the product-list delete button and cover thumbnails.

### 19.1 Decisions (user-confirmed before execution)

- **Cloudinary** for image hosting (`CLOUDINARY_*` keys in `.env`, `cloudinary` dep already installed, `next.config.ts` already whitelists `res.cloudinary.com`, seed data uses it).
- **No schema migration** — the phase ships with migrations still at **8**.
- Variation **create** lives on `/admin/products/[id]` (next to the variation list), not on `/admin/variations`.
- Extras taken **all**: product-list cover thumbnail + delete, image reorder (move first / move last), **and** category editing both inline in the product form *and* on a dedicated `/admin/categories` page.
- Server-action body cap raised: `experimental.serverActions.bodySizeLimit: "4mb"` (Next default is **1 MB**, too small for image uploads) with a **3.5 MB** per-file guard — multipart overhead keeps total under the cap.

### 19.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | No way to upload/order/delete product images | New plain module `image-ops.ts` (validate product → image count ≤10 → mime ∈ {jpeg,png,webp,avif,gif} → size ≤3.5 MB **all before** any upload; `uploadBuffer` via Cloudinary `upload_stream`; `deleteImageCore` row-delete + **best-effort** remote `destroy` in try/catch so missing CI credentials never fail; `moveImageCore` transaction rewrites gapless `sortOrder 0..n-1`) + `"use server"` wrapper `images.ts` (`uploadProductImage(formData)` / `deleteProductImage` / `moveProductImage`, `requireAdmin` first, revalidates `/admin/products`, `/admin/products/[id]`, `/product/[slug]`, `/shop`) | `src/modules/admin/{image-ops,images}.ts` |
| 2 | FK-RESTRICT violations on DELETE surface as `PrismaClientUnknownRequestError` (Postgres **23001**), not `P2003`/`P2014` — **`deleteProduct`'s friendly refusal never fired (it would 500 for real users)** | New `db-errors.ts`: `isForeignKeyRestriction` (KnownRequestError P2003/P2014 **or** error-cause-chain text `23001`/`foreign key constraint`/`RESTRICT setting`) + `isRecordNotFound` (P2025); `deleteProduct` and `deleteCategory` now use them | `src/modules/admin/db-errors.ts`, `products.ts`, `categories.ts` |
| 3 | Categories were read-only | `categories.ts` (requireAdmin-first `createCategory`/`updateCategory`/`deleteCategory` + `getAdminCategoriesWithCounts`, slug-unique handling incl. self-exclude, P2002 → field error, in-use → "Products still use this category — move them to another category first.", revalidates `/admin/categories`, `/admin/products`, `/`) + page `/admin/categories` (CategoryForm create/edit + CategoryRow two-step delete) + nav item | `src/modules/admin/categories.ts`, `src/app/admin/categories/page.tsx`, `src/app/admin/layout.tsx`, `components/admin/{CategoryForm,CategoryRow}.tsx` |
| 4 | No variation create (edit-only) | `createVariation` action: zod `createVariationSchema` (coerced `price` rupees ≥0.01, `stock` int ≥0), product-exists check, stores `Math.round(price * 100)` paisa, revalidates `/admin/variations`, product admin/storefront, `/shop` | `src/modules/admin/{variations,schema}.ts` |
| 5 | Product detail page had no images UI and no add-variation entry | Rewritten page: **Images** section (`ImageManager`: upload form, thumbnail grid, Move first/Move last, two-step Delete, `role="alert"`, `router.refresh()`, placeholder `<div>` when the URL host isn't optimizable) + **Variations** section (list, empty state, inline `VariationForm` create mode) | `src/app/admin/products/[id]/page.tsx`, `components/admin/{ImageManager,VariationForm}.tsx` |
| 6 | Category selection was a closed list | `ProductForm` gains a controlled `categoryId` + `＋ New category…` option → inline name/slug block → `createCategory` → auto-selects the new id; submit is blocked until the pending category is created | `components/admin/ProductForm.tsx` |
| 7 | Product list showed no cover and no delete | List rows render the first image via `next/image` (**only** when `isOptimizableImageUrl` allows the host — `src/lib/image.ts`, guards against non-Cloudinary rows crashing the image optimizer) + `ProductDeleteButton` (two-step `Yes, delete “…”`, inline `role="alert"` refusal) | `src/app/admin/products/page.tsx`, `components/admin/ProductDeleteButton.tsx`, `src/lib/image.ts` |
| 8 | `updateVariation` had no edit affordance in the detail list | `VariationRow` toggles an edit-mode `VariationForm` (name/price/isEnabled; **no stock field** — stock belongs to `adjustStock` on `/admin/variations`) | `components/admin/{VariationRow,VariationForm}.tsx` |

### 19.3 Behaviour worth knowing before touching this code

- **Two price contracts on purpose**: `createVariation` takes **rupees** (admin form displays rupees, server converts with `Math.round`) while `updateVariation` keeps its existing **paisa** contract (client converts on submit) — don't "unify" one way without updating both the forms and their tests.
- Upload limits: **10 images/product**, **3.5 MB/file**, mime allowlist `{image/jpeg,png,webp,avif,gif}` — all validated **before** any Cloudinary call; `bodySizeLimit: "4mb"` in `next.config.ts` must stay above the file cap.
- Remote `destroy` is best-effort: CI has **no** Cloudinary secrets; the row delete still succeeds (integration tests mock `cloudinary`, E2E's real upload check runs **only** when `CLOUDINARY_API_KEY` is a usable key — CI's placeholder `"0"` self-skips).
- `next/image` only renders for whitelisted hosts — `isOptimizableImageUrl` (`src/lib/image.ts`) is the single guard; unknown hosts fall back to a placeholder div.
- Category delete with products is **refused** (P2003-shaped, friendly copy); product delete with order/cart references likewise ("…existing orders or carts still reference it") — both now detected via `isForeignKeyRestriction` because Prisma's DELETE…RESTRICT error arrives as an *unknown* error, not a known request error.
- E2E upload calls use React's flight **multipart** encoding: fields `_1_<name>` first, root field `0` = `'["$K1"]'` **last** (the streaming/busboy decoder parses field `0` on arrival — if the root precedes the parts, the reconstructed FormData is empty).

### 19.4 Tests & gate

- Unit **166 → 186** (new `tests/unit/admin-catalog.test.ts`, **20**): `isOptimizableImageUrl` table + source guards — upload gate ordering (product → count → mime → size all before `await uploadBuffer(`), mime allowlist, 3.5 MB / 4 mb pairing, lazy `cloudinary.config` inside the helper, best-effort destroy, three image actions each `requireAdmin` + exact revalidation targets, rupees→paisa `Math.round` strings, product detail page mounts both new sections, category CRUD gates/P2003-style messages/nav/page, ProductForm inline category, list thumbnail + delete button.
- Integration **142 → 170** (new `tests/integration/admin-catalog.test.ts`, **28**): `cloudinary` **mocked** (`vi.hoisted` upload_stream/destroy/config) — upload happy path + sortOrder append + mime/size/count/unknown-product refusals (asserting zero upload calls) + upload-failure → friendly error; delete row + destroy public-id + destroy-failure tolerated; move first/last gapless orders; category create/dup-slug/self-slug-ok/steal-refused/in-use-refused/empty-delete/counts/requireAdmin gates; `createVariation` `1800.5 → 180050` paisa + validation + `updateVariation` paisa contract; **first automated `deleteProduct` coverage** (order-referenced refusal keeps the product, unreferenced cascades variations+images, unknown id).
- Smoke **10 → 12 pages** (`GET /admin/categories`, `GET /admin/products/<id>` for a fixture product). E2E **108 → 143 checks** (new section 15: 7 action-id resolutions, categories page, category create → rendered list → offered by the product form, in-use refusal, empty delete → gone, detail page images/variation sections, createVariation → paisa → storefront visibility, `.txt` refusal with zero stored rows, **conditional real Cloudinary upload**, reorder first/last with gapless `sortOrder`, image delete, list cover thumbnail + delete button, `deleteProduct` refusal-then-success; plus a `callActionFormData` helper for flight multipart).
- Gate: `npm run test` **356/356** (186 unit / 15 files + 170 integration / 25 files) · `tsc --noEmit` clean · `npm run lint` **0/0** · `prisma validate` + `migrate status` (**8**, none pending) · `npm run build` green (`/admin/categories` a real route) · **smoke 12/12 + E2E 143/143** on the dev DB · post-run leftover query **0** e2e/smoke products, images, variations, orders (the one `phase5-e2e` category is pre-existing Phase-5 dev data with 5 products).

### 19.5 Manual browser checklist (needs a human; server on `:3100`)

1) `/admin/products` shows each product's cover thumbnail and a **Delete** button → first click swaps to `Yes, delete “…”`, second click deletes (or shows the orders/carts refusal inline). 2) Open a product → **Images** section: upload a real JPG/PNG (progress "Uploading…" → thumbnail appears), **Move first / Move last** reorder instantly, two-step **Delete** removes the row. 3) Try uploading a `.txt` (or a >3.5 MB file) → inline `role="alert"` refusal, nothing stored. 4) **Add variation** inline (name + price in rupees + stock) → shows in the variation list, on `/admin/variations`, and as a selectable price on the storefront product page; **Edit** on a row changes name/price without a stock field. 5) `/admin/categories`: create a category → it appears in the product form's category select; delete a category that still has products → refusal copy; delete an empty one → gone. 6) `/admin/products/new` → pick `＋ New category…` → enter name/slug → saved and auto-selected → product saves cleanly. 7) As admin, confirm a `.jpg` upload actually lands on `res.cloudinary.com` and renders through `/_next/image` (non-Cloudinary URLs must render as a placeholder div, never an optimizer 500).

### 19.6 Errors hit in Phase 11 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | Unit order-gate assertion failed (`db.product.findUnique` not before `uploadAt`) | `ops.indexOf("uploadBuffer(")` matched the function **definition**, which precedes the validations | match the call site `await uploadBuffer(`; assert usage forms (`ALLOWED_IMAGE_TYPES.includes`, `file.size > MAX_IMAGE_BYTES`) instead of the top-of-file const declarations |
| 2 | Integration: `deleteProduct` threw `PrismaClientUnknownRequestError` (Postgres `23001` … `RESTRICT setting of foreign key constraint`) and `deleteCategory` returned its generic error | Prisma maps FK violations on INSERT/UPDATE to P2003/P2014, but **DELETE…RESTRICT arrives as an unknown error** — the pre-existing `deleteProduct` catch never matched (latent 500 for users) | new `db-errors.ts` helpers scanning the error/cause chain for `23001`/FK text; both delete actions now use them (this is why the tests exist) |
| 3 | `tsc` TS2345/TS2352 on `db.order.create({…} as Prisma.OrderUncheckedCreateInput)` | the cast was applied to the whole `{data: …}` argument | dropped the cast — the nested `items: {create: …}` shape is a valid checked create |
| 4 | E2E: upload actions returned `{"success":false,"error":"Product not found."}` although the multipart body was accepted | the flight **streaming (busboy) decoder parses field `0` on arrival** — the root `["$K1"]` was appended first, so the `$K` scan rebuilt an *empty* FormData before `_1_productId`/`_1_file` arrived; React's own encoder sets the root **last** | `callActionFormData` appends `_1_*` parts first, root `0` last (documented in the helper) |
| 5 | E2E: "cover thumbnail missing" — looked for `e2e-b.jpg` | after reorder + the real upload, the fixture's cover was the *uploaded* image, not the seeded one | assert the fixture row exists and the page renders `/_next/image?url=` (optimizable host) |
| 6 | CI: `real Cloudinary upload → success` failed ("Upload failed — check the Cloudinary configuration") even though the gate was "credentials present" | CI injects **placeholder** stand-ins (`CLOUDINARY_CLOUD_NAME: ci`, `CLOUDINARY_API_KEY: "0"`) so the cloud-name check looked satisfied and called Cloudinary with fake creds | gate the check on a usable key (`CLOUDINARY_API_KEY` set and ≠ `"0"`) — CI skips, local `.env` real keys still run; ci.yml comment notes the self-skip |

### 19.7 Decisions recorded

- **Stock is not editable in the variation edit form** — `updateVariation` stays name/price/isEnabled; stock changes go through `adjustStock` (audit trail, `/admin/variations`).
- `updateVariation`'s paisa contract is kept deliberately (Phase 5 callers) while `createVariation` speaks rupees; the conversion lives server-side in each action.
- Limits frozen at **10 images / 3.5 MB / 4 mb action body** — any bump must move both `MAX_IMAGE_BYTES` and `bodySizeLimit` together (unit test keeps them paired).
- Non-`res.cloudinary.com` URLs are treated as non-optimizable (placeholder div) rather than added to the `images.remotePatterns` allowlist.

---

## 20. Phase 12 — account completion — detailed log (what & why)

Scope: wire `SavedShipping` into checkout + a new `/account/addresses` page, customer **cancel / reorder / receipt**, and the account section sub-nav. No migration (8 stays 8), no new dependencies.

### 20.1 Decisions (user-confirmed before execution)

1. **Cancel = unpaid only.** Eligibility is `paymentStatus === "PENDING"` AND `orderStatus ∈ {PENDING, CONFIRMED}`. Paid, PROCESSING/SHIPPED, DELIVERED orders refuse with distinct messages and route to support/admin — the customer path can therefore **never** reach refund logic (no refund code is reachable from it).
2. **Checkout = prefill + save checkbox.** Signed-in users get their saved address + profile email prefilled and a `Save as my shipping address` checkbox (default checked). The upsert runs **after** the order commits, best-effort (same swallow-and-log pattern as the Safepay URL) — a storage failure never fails an order.
3. **Reorder = stay + inline summary.** `Buy again` keeps the customer on the order page and reports `role="status"` ("Added N items — M unavailable (…)") or `role="alert"`; no navigation.

### 20.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | The order status state machine (CAS, restock, audit) lived in the **admin** module; customers had no cancel | `git mv src/modules/admin/order-ops.ts → src/modules/orders/status-ops.ts`; `adminId: string \| null` (NULL = customer, existing convention in `StockAdjustment`); customer cancel reason `"Order {n} cancelled by customer"` keeps the admin string byte-identical; `OrderStatusInput`/`orderStatusSchema` moved to `orders/schema.ts`; `OrderActionResult` type added; admin barrel re-imports from `@/modules/orders` | `src/modules/orders/{status-ops,schema,types,index}.ts`, `src/modules/admin/{orders,schema,index}.ts` |
| 2 | `SavedShipping` existed in the schema but was wired **nowhere** | New `src/modules/addresses/`: `schema.ts` (shared `shippingFields` + `savedShippingSchema`), `ops.ts` (`upsertSavedShippingForUser` — one row per user, `"" → NULL` postal), `actions.ts` (`saveShippingAddress`/`deleteShippingAddress`, validate-first, revalidates `/account/addresses` + `/checkout`), `queries.ts` (`getMyShippingAddress`), barrel | `src/modules/addresses/` |
| 3 | Checkout always started blank and forgot the address | `checkout/schema.ts` **composes `shippingFields`** (address form and checkout can't drift) + optional `saveAddress`; `placeOrder` upserts the address after `placeOrderCore` succeeds, inside try/catch; `checkout/page.tsx` passes profile email + saved address; `CheckoutForm` prefills every shipping field + email, renders the checkbox only for signed-in users, submits `saveAddress: formData.get("saveAddress") === "on"` | `src/modules/checkout/*`, `checkout/page.tsx`, `CheckoutForm.tsx` |
| 4 | No customer cancel | `canCustomerCancel(order)` (pure — page renders the button, action re-validates, ONE rule) in `status-ops.ts`; `cancelMyOrder` action: auth → owner-scoped fetch → `"Order not found."` (indistinguishable from missing, same rule as `retrySafepayPayment`) → distinct refusal messages (already cancelled/delivered/being prepared/already paid) → `updateOrderStatusCore(…, null)` → revalidates `/account/orders`, the order, `("/", "layout")`; `CancelOrderButton` two-step (`Cancel order` → `Yes, cancel order #N`, `role="alert"`) | `orders/{actions,status-ops}.ts`, `components/storefront/CancelOrderButton.tsx` |
| 5 | No reorder | `reorderOrder` loops the existing `addToCart(variationId, quantity)` per line (so qty validation, live stock, disabled-line refusal, merging and revalidation are the ONE implementation), aggregates `{added, skipped: ["Product — Variation"]}`, fails with the skipped list when nothing is available; `ReorderButton` stays on the page, `router.refresh()` for the badge | `orders/actions.ts`, `components/storefront/ReorderButton.tsx` |
| 6 | No receipt/invoice; detail page deliberately withholds PII | `OrderView.items` gains `variationId` (type + all three mappers); `getMyOrderForReceipt(id)` returns the full delivery block (email/phone/postal/notes/createdAt/totals), owner-only, `null` otherwise; `/account/orders/[id]/receipt` page renders the printable invoice with `print:hidden` chrome + `PrintButton` (`window.print()`); detail page gains the action bar: Cancel (gated) / Buy again / View receipt | `orders/{types,queries}.ts`, `app/account/orders/[id]/{page.tsx,receipt/page.tsx}`, `components/storefront/{PrintButton}.tsx` |
| 7 | No account section navigation | `AccountNav` (client, `usePathname`, exact-or-prefix match with separator guard so `/account/orders` never lights up for a sibling prefix, `aria-current="page"`, **no** `role="tab"`) mounted once in `account/layout.tsx`; dashboard gains a Shipping Address card; footer gains `/account/addresses` | `components/storefront/AccountNav.tsx`, `app/account/{layout,page}.tsx`, `Footer.tsx` |
| 8 | Breadcrumb/footer unit tests knew nothing of the new pages | `storefront-shell.test.ts`: allowed href set += `/account/addresses`; breadcrumb list += addresses + receipt pages | `tests/unit/storefront-shell.test.ts` |

### 20.3 Behaviour worth knowing before touching this code

- **`canCustomerCancel` is the single eligibility rule** — never inline a second copy in a page or action. It is deliberately narrower than the admin machine.
- **The customer cancel path contains no refund logic.** Reaching `updateOrderStatusCore` with `orderStatus: CANCELLED` implies payment was PENDING, so `adminId: null` never pairs with a refund audit row. **TOCTOU accepted:** eligibility is pre-checked then CAS'd — a concurrent transition could cancel a just-turned-PROCESSING order whose payment is still PENDING (harmless: stock is restocked, no money moved). Documented, not locked.
- **Ownership errors are anti-enumeration:** stranger id and missing id both answer `"Order not found."` (cancel, reorder, receipt query).
- **Anonymous `/account/*` POSTs never reach actions** — `src/proxy.ts` 307s them to `/login?callbackUrl=…` first (E2E asserts the bounce; the action's own session check is integration-tested).
- **Soft-404 status:** `src/app/account/loading.tsx` streams the shell, so a `notFound()` from these pages answers **200 + "Page not found" content** — the exact trade-off Phase 7 documented for `/product/[slug]`. Assert content, not status (E2E does).
- Saved-address storage is **best-effort after order commit**; failures log (`console.error("Failed to save shipping address:", …)`) and the order still succeeds.
- Guest orders are not reorderable and not receiptable (receipt query requires a session; there is no guest ownership story).

### 20.4 Tests & gate

- Unit **186 → 220** (16 files): new `tests/unit/account-completion.test.ts` (**32**) — `canCustomerCancel` matrix (PENDING/CONFIRMED × PENDING allowed; PROCESSING/SHIPPED/DELIVERED/CANCELLED and any PAID/REFUNDED/FAILED refused), `savedShippingSchema` (valid, `""/undefined` postal, required fields, length caps), checkout composition (shared error message, `saveAddress` optional, `paymentMethod` still validated), AccountNav source wiring (`aria-current`, prefix+separator guard, layout mount, footer link), checkout prefill/checkbox/best-effort-save source wiring, cancel two-step / reorder inline / receipt `print:hidden` / `addToCart` replay. Plus 2 breadcrumb-list entries in `storefront-shell.test.ts`.
- Integration **170 → 196** (29 files): `customer-cancel.test.ts` (**8**) — session, stranger ≡ missing error, owner cancel → CANCELLED + restock + `adminId: null` audit + `"cancelled by customer"` reason, CONFIRMED ok, PROCESSING/PAID/CANCELLED/DELIVERED refusals with zero side effects; `reorder.test.ts` (**6**) — session, stranger ≡ missing, happy path into the account cart, disabled line skipped by name, all-unavailable failure, empty order; `addresses.test.ts` (**8**) — session, field errors, upsert stays one row, two users independent, idempotent delete, prefill nulls, `"" → NULL` postal; `receipt.test.ts` (**4**) — guest null, stranger ≡ missing null, full invoice view for owner, **detail view asserts PII keys absent**.
- Gate: `npm run test` **416/416** (220 unit / 16 files + 196 integration / 29 files) · `tsc --noEmit` clean · `npm run lint` **0/0** · `prisma validate` + `migrate status` (**8**, unchanged — no migration) · `npm run build` green (+`/account/addresses`, +`/account/orders/[id]/receipt` routes) · **smoke 14/14 + E2E 183/183** on the dev DB · post-run leftover query **0** (orders, products, carts, users, and no stray `SavedShipping` row for `dev-customer`).

### 20.5 Manual browser checklist (needs a human; server on `:3100`)

1. `/account` → Shipping Address card, sub-nav shows Overview current (`aria-current`), footer link works.
2. `/account/addresses` → save (values persist after reload), edit + save updates, Delete → two-step confirm → form empties; invalid submit shows `role="alert"` field errors without wiping input.
3. Logged-out `/checkout` → no prefill, no checkbox. Logged-in → saved address + profile email prefilled, checkbox present (checked).
4. Place an order **unchecked** → saved address unchanged; **checked** (edit city first) → `/account/addresses` shows the new city.
5. `/account/orders/<unpaid>` → Cancel order → confirm text → order becomes CANCELLED, button disappears, stock back; Paid/PROCESSING orders show no Cancel and the action would refuse.
6. Buy again → stays on page, `role="status"` summary with skipped names if any, cart badge increments.
7. View receipt → invoice with full address/phone/email; `Print receipt` opens print preview with nav/chrome hidden.
8. Receipt + detail URLs as a different signed-in user → "Page not found".

### 20.6 Errors hit in Phase 12 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | Smoke: `/account/addresses` + receipt **404** although `npm run build` listed both routes | the **Phase 11 server (pid 67041)** was still bound to `:3100` — `lsof -ti:3100` returned empty (permission/namespace), so my `lsof … xargs kill` falsely reported "port free"; my new `next start` died on `EADDRINUSE` | kill the known pids, verify with `ss -ltnp \| grep 3100`, restart, re-check — **never trust `lsof` emptiness alone here; `ss` is authoritative** |
| 2 | Reorder integration: `db.cart.findUniqueOrThrow` failed in the "nothing available" test | `addToCart` refuses the out-of-stock line **before** any cart row exists | assert with `findFirst` + conditional zero-line check |
| 3 | E2E: 3× "…without a session" got `json: null` | the **proxy 307-redirects anonymous POSTs** to `/account/*` before Next ever dispatches the action → non-flight response | assert `3xx + location /login` (that IS the enforcement chain; the action's own `auth()` check stays integration-tested) |
| 4 | E2E: stranger receipt/detail returned **200**, not 404 | `src/app/account/loading.tsx` streams the shell → `notFound()` arrives after the 200 header (the documented Phase 7 soft-404 trade-off) | assert `"Page not found"` content + owner PII absent, not status — same as the existing `/product/[slug]` checks |
| 5 | Draft test used `db.product.findUniqueOrThrow({ where: { productId } })` | Product's PK is `id`; `productId` lives on the child rows | fixed to `where: { id: variation.productId }` before the suite ever ran |

### 20.7 Decisions recorded

- User answered the three scope questions with the recommended options: **unpaid-only cancel**, **prefill + save checkbox**, **stay + inline reorder summary**.
- No migration: `SavedShipping` already existed; `StockAdjustment.adminId` is nullable by design ("NULL = legacy/customer" — Phase 12 now gives it its second, intended meaning).
- Shared shipping rules live once (`shippingFields` in `src/modules/addresses/schema.ts`) and are composed into `checkoutSchema` — drift between the address form and checkout is impossible by construction.
- All new account components live in `src/components/storefront/` (ProfileForm precedent); actions/queries stay in the module the ESLint boundary allows (`@/modules/*/actions` or the barrel).
- E2E's anonymous-action checks intentionally assert the **proxy bounce**, not the action's session error — two layers, tested at the layer that runs.

---

## 21. Phase 13 — admin ops & dashboard — detailed log (what & why)

Scope: real `/admin` dashboard (metrics + hand-rolled SVG chart — no chart library), admin order detail page + standalone **refund**, `/admin/stock` audit feed, order list filters. No migration (8 stays 8), no new dependencies.

### 21.1 Decisions (user-confirmed before execution)

1. **Refund = money back, order kept.** A standalone `refundOrderPayment` for **PAID** orders: Safepay → real `refundSafepayPayment` call **before** any state change, then CAS `PAID → REFUNDED`; COD → state flip only (staff return cash offline). `orderStatus` is untouched, **no restock and no `StockAdjustment` row** — a return-then-restock goes through `CANCELLED` instead. The control lives on the **detail page only** (the list row never offers it).
2. **Stock history = dedicated `/admin/stock` page** (not a dashboard section): the cross-product `StockAdjustment` feed with admin/customer attribution, newest first, searchable, capped at 200.
3. **Dashboard = KPIs + 14-day hand-rolled SVG chart + lists** — five KPI cards, a server-rendered `role="img"` bar chart (zero client JS), orders-by-status bars, low-stock list, recent-orders list.

### 21.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | Refund existed only buried in the cancel branch of `updateOrderStatusCore`; no way to refund a delivered order | New `refundOrderPayment(orderId)`: `requireAdmin` → not-found / already-refunded / not-PAID refusals with named statuses → Safepay branch (tracker required, API call **before** state, `SafepayRefundError` → "Safepay rejected the refund — the order was NOT changed…") → CAS `updateMany {id, paymentStatus:"PAID"} → REFUNDED` → revalidates list **and** detail. Plus `getAdminOrders(filters)` (exact known status — unknown strings ignored, insensitive search across orderNumber/customerName/customerEmail, trimmed) and `getAdminOrderById` now joins the customer `user` for the profile link; `updateOrderStatus`/`markCodPaymentReceived` also revalidate the detail path | `src/modules/admin/orders.ts` |
| 2 | Order controls lived inline in `AdminOrderRow`; no detail page at all | Shared **`OrderActions`** client component (optimistic status select with rollback, COD-only `Mark Paid`, two-step `Refund` gated by `allowRefund && paymentStatus === "PAID"`, `role="alert"`); `AdminOrderRow` delegates to it and links the order number to the detail page; new `/admin/orders/[id]` renders customer (link to `/admin/customers/[id]`), delivery block, line items + totals, payment block, `notFound()` for unknown ids | `src/components/admin/{OrderActions,AdminOrderRow}.tsx`, `src/app/admin/orders/[id]/page.tsx` |
| 3 | `/admin/orders` had no filters | Status tabs (All + 6, `aria-current="page"` Link pattern from `/admin/reviews`) + GET search form (pattern from `/admin/customers`); each preserves the other's query param via `tabHref()` / hidden `status` input; blank search = no filter | `src/app/admin/orders/page.tsx` |
| 4 | `getStockAdjustmentHistory` was exported but rendered nowhere | `getStockAdjustmentFeed({search})` (`"use server"`): `requireAdmin` first, include `variation.product` + `admin {name,email}`, newest-first `take: 200`, OR-search on variation/product names; new `/admin/stock` page renders product → variation, `prev → new (±delta)`, reason, actor (`admin.email` or **"Customer (order cancel)"** when `adminId === null`), `formatDate` + PKT clock time; `Stock` nav item added | `src/modules/admin/stock.ts`, `src/app/admin/stock/page.tsx`, `src/app/admin/layout.tsx` |
| 5 | `/admin` was a 3-line stub; `dashboard.ts` held a dead `testAdminAction()` POC | **`dashboard-ops.ts` (plain file)**: tuning consts (`LOW_STOCK_THRESHOLD = 3`, `KPI_WINDOW_DAYS = 30`, `CHART_DAYS = 14`), `dayKey()` via `Intl "en-CA"` pinned to **Asia/Karachi**, pure `buildDailyRevenueSeries(orders, now)` (zero-filled 14 labels, PAID-only, drops out-of-window days). **`dashboard.ts` (`"use server"`, one export)**: `getDashboardMetrics()` = one `Promise.all` of bounded queries — `aggregate` revenue30 (PAID only), `count` orders30/customers30/pendingReviews/lowStock, chart orders fetched with a **+1 day buffer** then bucketed in JS, **first `groupBy` in the repo** on `orderStatus` (zero-filled to all 6), lowStockList/`recentOrders` `take: 8`. **`/admin/page.tsx`**: KPI cards (revenue/orders/customers/pending reviews/low stock, the last two linking into their filtered pages), `viewBox` SVG bars with per-bar `<title>` + `aria-label` + empty state, by-status bars, low-stock + recent lists. POC deleted | `src/modules/admin/{dashboard-ops,dashboard}.ts`, `src/app/admin/page.tsx` |
| 6 | `"use server"` modules may only export async functions; both filters + shapes needed a home; barrel had to grow | New plain `src/modules/admin/types.ts` (`AdminOrderFilters`, `DailyRevenuePoint`, `DashboardMetrics`, `StockFeedRow`); barrel re-exports the new actions/types/consts | `src/modules/admin/{types,index}.ts` |
| 7 | `client-forms-guard` required `role="alert"` + `result.success`/`setError(` **in `AdminOrderRow`** | Feedback moved with the controls → the guard's lists now point at `OrderActions.tsx` | `tests/unit/client-forms-guard.test.ts` |

### 21.3 Behaviour worth knowing before touching this code

- **Refund is money-only.** It never touches `orderStatus`, stock or `StockAdjustment` — the cancel branch (`status-ops.ts`) is the *only* path that refunds **and** restocks. CANCELLED + PAID orders can still be refunded here (remediation), then stay CANCELLED.
- **Safepay refund ordering is the invariant:** API call → success → CAS. A refusal (no tracker, API error, lost CAS) leaves `paymentStatus` exactly as it was — same money-before-state rule as Phase 3's cancel branch.
- **`"use server"` export rule:** only async functions (+ types). Constants and the pure series builder live in `dashboard-ops.ts` — a plain file — so unit tests and server components can import them without creating server actions.
- **Revenue = PAID only.** `revenue30` and the chart both exclude PENDING/FAILED/REFUNDED (a refunded day must not read as revenue). Day buckets are **Asia/Karachi** — a UTC deployment would otherwise split "today" for a PK visitor; the chart fetches `CHART_DAYS + 1` days so early-morning PK orders are never lost to the window edge.
- **One `OrderActions`, two surfaces:** `allowRefund` defaults `false` (list row) and is passed only by the detail page — the approved plan keeps refund off the list. Status select + Mark Paid appear in both; failures always render `role="alert"` with optimistic rollback.
- **Filters ignore unknown status values** (reviews pattern) and trim search; a blank/whitespace search is "no filter", not "match nothing".
- **Stock feed attribution:** `adminId === null` = customer cancel (Phase 12 convention); `take: 200` keeps the page one bounded read (newest first).
- **Dashboard is a server component end-to-end** — the chart is hand-rolled SVG, so `/admin` ships zero client JS of its own. KPI windows are constants in `dashboard-ops.ts`; change them there, not in the page.
- **Proxy:** anon `/admin/*` → `/login?callbackUrl=…`, signed-in non-admin → `/` (E2E asserts both on the detail URL *and* on refund POSTs — the proxy answers before the action runs).

### 21.4 Tests & gate

- Unit **220 → 252** (17 files): new `tests/unit/admin-ops.test.ts` (**32**) — `buildDailyRevenueSeries` (zero-fill 14 days, PAID-only, same-day accumulation, **Karachi bucketing** with a late-UTC order landing on the PK date, out-of-window drop, purity), tuning constants + timezone pin, refund source guards (Safepay API **before** `updateMany`, no stock/audit writes, CAS + refusal text, gate ordering, detail revalidation ×3), filters/detail guards, dashboard module guards (`"use server"` exports exactly `getDashboardMetrics`, `testAdminAction` gone from **all** of `src/`, PAID-only revenue, `groupBy`, `take: 8` caps), dashboard page guards (server component, `role="img"`, links), order/stock UI guards (detail-only refund, two-step confirm, tabs preserve search, Stock nav, feed attribution/search/bounds). Plus the `client-forms-guard` re-point (§21.2 row 7).
- Integration **196 → 221** (30 files): new `tests/integration/admin-ops.test.ts` (**25**) — `refundOrderPayment` (missing, PENDING, already-refunded, **COD PAID success** asserting `orderStatus` kept + zero audit rows + stock untouched, **SAFEPAY success** asserting `(tracker, total)` + revalidation, no-tracker refusal, API-throw refusal with state untouched, lost-CAS), `getAdminOrders` (status, unknown status ignored, insensitive search across all three fields, status∩search, trim, items include), `getAdminOrderById` (join + null), `updateOrderStatus` revalidates detail, `getDashboardMetrics` (revenue30 PAID-only vs window, series exclusion, six-status zero-fill, low-stock threshold + disabled exclusion, pending reviews + windowed customers, recent capped/sorted), `getStockAdjustmentFeed` (attribution incl. `adminId: null`, product/variation search, empty, 200 cap).
- Gate: `npm run test` **473/473** (252 unit / 17 files + 221 integration / 30 files) · `tsc --noEmit` clean · `eslint .` **0/0** · `prisma validate` + `migrate status` (**8**, unchanged — no migration) · `npm run build` green (+`/admin/stock`, +`/admin/orders/[id]` routes) · **smoke 17/17 + E2E 212/212** (section 17, 29 new checks: dashboard render/KPI/chart/nav, tab+search filters incl. mutual preservation and unknown-status, detail render + gating buttons + anon/customer proxy + 404 view, refund anon/customer bounce, PENDING/no-tracker/real-Safepay refusals, COD success → REFUNDED + order kept + zero audit rows + double-refund refusal + rendered state, list never offers Refund, stock page/feed/search/empty) on the new build (server pid 15116, `ss`-verified) · post-run leftover query **0** (orders + stock rows).

### 21.5 Manual browser checklist (needs a human; server on `:3100`)

1. `/admin` → five KPI cards; the SVG chart shows 14 dated bars with hover `<title>` tooltips (or the empty state); "Pending reviews"/"Low stock" cards link into their filtered pages; Recent orders rows open the detail page.
2. `/admin/orders?status=SHIPPED` → only shipped rows, tab shows `aria-current`; type a search → the tab keeps its status and vice versa; a nonsense `?status=` still lists everything.
3. Row click / order number → `/admin/orders/<id>`: customer block links to `/admin/customers/<id>`, items + subtotal/shipping/total, delivery block, payment block with tracker.
4. **Refund (detail page, PAID order)** → button `Refund` → two-step `Yes, refund Rs. X` → payment badge flips to REFUNDED, **order status unchanged**, no stock change on `/admin/stock`.
5. Refund attempts on PENDING/REFUNDED orders, and a Safepay order without a tracker → `role="alert"` refusals with the named statuses; list rows **never** show a Refund button.
6. `/admin/stock` → every adjustment newest-first with product link, `prev → new (±delta)`, reason, `admin@…` or "Customer (order cancel)"; search narrows; nonsense search shows the empty state; **Stock** nav item is present.
7. Open a detail URL logged out → `/login?callbackUrl=…`; as a customer → redirected home; unknown id → "Page not found".

### 21.6 Errors hit in Phase 13 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | `tsc`: `AdminOrderFilters` declared twice + barrel re-exported it from `./orders` after the move; `countsByStatus.get(status)` typed `OrderStatus` vs `string` | two sources of truth while splitting types out of a `"use server"` file; `groupBy` returns the Prisma enum | single owner in `types.ts` (barrel re-exports the **type** from there); `new Map<string, number>(…)` with `as string` keys |
| 2 | `client-forms-guard` failed: `AdminOrderRow` no longer contains `role="alert"` / `result.success` / `setError(` | those checks followed the controls into `OrderActions` | re-pointed the guard's two lists at `OrderActions.tsx` (behaviour moved, assertion intent unchanged) |
| 3 | Unit guard failed: `refund.indexOf("await requireAdmin()")` expected `0` | the slice starts at the function **signature line**, so `requireAdmin` sits at offset ~90 | assert ordering instead (`< indexOf("db.order.findUnique")`) — ordering, not position, is the invariant |
| 4 | E2E "unknown order id renders our 404 view" got **307** | fetched anonymously → the **proxy** answered `/login` before the page could 404 | fetch with the admin jar (the anon bounce is already asserted separately) |
| 5 | E2E "detail page reflects the refunded payment" — `Payment: REFUNDED` not found | React splits adjacent text nodes into `Payment: <!-- -->REFUNDED` in SSR HTML | matcher tolerates the comment: `/Payment:\s*(?:<!-- -->)?REFUNDED/` |
| 6 | `tsc`: `StockFeedRow` has no `variationId` (TS2551) in the feed test | the type mirrored only the presentation fields | added `variationId: string` — the query returns it and the test asserts it |
| 7 | (pre-run) planned feed-search E2E searched the **reason** text | feed search matches product/variation **names**, not reasons | switched the check to the fixture product name before the suite ran |
| 8 | Tool wrapper rejected `pkill -f` (`ChildProcess.kill` error) while restarting the server | the shell tool blocks pattern-kill | `kill <pid>` + `ss -ltnp \| grep 3100` (the Phase 12 lesson: `ss`, not `lsof`, is authoritative) |

### 21.7 Decisions recorded

- User answered the three scope questions with the recommended options: **refund = money back, order kept**; **dedicated `/admin/stock` page**; **KPIs + hand-rolled 14-day SVG chart + lists**.
- No migration (8 stays 8) and no new dependencies — the chart is inline SVG with design tokens (`fill-sage`, `text-muted`), matching the §2 "hand-rolled CSS/SVG charts" decision.
- Refund stays **detail-page-only** (approved non-goal): `OrderActions` takes `allowRefund` (default `false`); the list keeps status + Mark Paid. E2E asserts the control never leaks into the list.
- `"use server"` purity enforced structurally: constants + the pure series builder live in plain files (`dashboard-ops.ts`, `types.ts`) — the same split `image-ops.ts`/`status-ops.ts` already established.
- Refund deliberately has **no audit table** in this phase (money state is `paymentStatus`; an order-scoped refund timeline is out of scope until emails/Phase 14 make it worth a migration).
- Dashboard metrics are computed with **SQL aggregates** (`aggregate`/`count`/`groupBy`) and only the 14-day series is bucketed in JS (day boundaries must be Karachi) — never "fetch all orders, sum in the page".

---

## 22. Phase 14 — emails (Resend) + forgot/reset password — detailed log (what & why)

Scope: transactional email transport with a **dev-log fallback** (no Resend key yet), five key-transition templates (order received, payment result, status updates, welcome, password reset), the four post-commit hook sites, and a complete **forgot/reset password** flow. Migration 8 → **9** (`PasswordResetToken`), one new dependency (`resend`, lazy-loaded).

### 22.1 Decisions (user-confirmed before execution)

1. **Dev-log fallback only.** No real Resend key now. With `RESEND_API_KEY` missing or set to `ci-placeholder`, every send prints `[email] dev-log → to=… subject="…"` to the server log. Adding a key later activates real sends with **zero code change** — same module, same call sites.
2. **Key transitions only:** order received (COD + Safepay), payment result (CONFIRMED / FAILED / REFUNDED, webhook-driven), status mail for **SHIPPED / DELIVERED / CANCELLED**, welcome, forgot/reset. CONFIRMED/PROCESSING stay quiet to avoid inbox noise; `markCodPaymentReceived` and the admin `refundOrderPayment` deliberately send **nothing** (webhook-only payment mail per scope).
3. **Search (Phase 15) — products only; header form → `/search`** (recorded here because it was decided with this phase).
4. **Two gated sub-phases:** 14 → full gate → docs §22 → commit/push/CI, then 15 → gate → §23 → commit/push/CI.

### 22.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | `src/lib/email.ts` was a 0-byte placeholder; nothing could send mail | Transport: `isEmailDevLogMode()` (no key OR `ci-placeholder` → dev-log), `sendEmail()` (throws on transport failure), **`sendEmailSafe()`** (never throws — every hook uses it, the Safepay-URL swallow-and-log rule applied to email), `EMAIL_FROM` env with `Girah <onboarding@resend.dev>` fallback. Client construction is **lazy** (`await import("resend")`, cached, named-export `Resend`) — importing the module never needs a key, so every suite and build can load it (the `image-ops.ts` ensureCloudinary pattern) | `src/lib/email.ts` |
| 2 | No templates existed | Pure builders returning `{to, subject, html, text}`: `orderReceivedEmail`, `paymentResultEmail(order, CONFIRMED\|FAILED\|REFUNDED)`, `orderStatusEmail(order, SHIPPED\|DELIVERED\|CANCELLED)`, `welcomeEmail`, `passwordResetEmail`. Inline-styled HTML shell (sage/cream tokens), `formatPrice`/`formatDate` only, per-outcome copy (refund wording depends on `paymentStatus`, cancel-without-refund says "any due refund is on its way") | `src/lib/email-templates.ts` |
| 3 | Nothing triggered mail | Four `sendEmailSafe` hooks, all **post-commit best-effort**: (a) `placeOrder` → order-received after `revalidatePath` + save-address, before the Safepay URL block; (b) webhook `handleSuccess`/`handleFailure`/`handleRefund` → payment result **only when `claimed.count === 1`** (a duplicate delivery that lost the CAS must not send a second "confirmed"); (c) `updateOrderStatusCore` → status mail before the final `return {success:true}` when next ∈ {SHIPPED, DELIVERED, CANCELLED} (the single choke point — admin select *and* customer cancel land here); (d) `register` → welcome after the guest-cart merge | `src/modules/{checkout/actions,payments/webhook-core,orders/status-ops,accounts/actions}.ts` |
| 4 | No storage for reset tokens | Migration `phase14_password_reset`: `PasswordResetToken {id, userId FK cascade, tokenHash @unique, expiresAt, createdAt, @@index([userId])}` + `User.passwordResetTokens`. Only the **SHA-256 hash** of the raw token is stored — a DB leak must not hand out working links. Added to the `resetDb` TRUNCATE list | `prisma/schema.prisma`, `prisma/migrations/20260927035350_phase14_password_reset`, `tests/setup/helpers.ts` |
| 5 | No forgot/reset flow existed | `forgotPasswordSchema` + `resetPasswordSchema` (password ≥8 + confirm refine, mirroring `registerSchema`); actions `requestPasswordReset` / `resetPassword` in the accounts module (§22.3) | `src/modules/accounts/{schema,actions}.ts` |
| 6 | No UI | `(auth)/forgot-password` + `(auth)/reset-password` pages (awaited `searchParams`, login-page pattern) with `ForgotPasswordForm`/`ResetPasswordForm` (LoginForm style: `onSubmit` + `preventDefault` + `FormData`, `role="alert"`/`role="status"`, pending states); "Forgot password?" link added to the login password field; both forms added to `CLIENT_FORMS` | `src/app/(auth)/{forgot-password,reset-password}/page.tsx`, `src/components/storefront/{Forgot,Reset}PasswordForm.tsx`, `LoginForm.tsx`, `tests/unit/client-forms-guard.test.ts` |
| 7 | Suites could hit a real transport if a dev `.env` carried a key; no coverage of any of the above | `tests/setup/env.ts` forces `RESEND_API_KEY=ci-placeholder` for every worker (no suite can ever send real mail); unit `email-ops` (23), integration `password-reset` (13) + `email-hooks` (12, `vi.mock("@/lib/email")`); smoke +2 pages; E2E **section 18** (17 checks) | `tests/`, `scripts/{smoke,e2e}.mjs` |

### 22.3 Behaviour worth knowing before touching this code

- **Anti-enumeration is structural, not cosmetic.** `requestPasswordReset` returns the same generic success for known and unknown addresses, and the rate-limit **key (`pwreset:<email>`) is burned before the user lookup** — a missing account still consumes a failure. Integration asserts the two responses are byte-identical. Do not "helpfully" add an `email not found` error.
- **The link lives one hour and only one link is live:** a new request `deleteMany`s the user's previous tokens in the same transaction. The raw token exists **only** in the mail body (E2E hand-crafts rows with `sha256(raw)` because the server log is not readable cross-process).
- **Reset = password + `sessionVersion {increment: 1}` + consume every token** in one `$transaction` — the `changePassword` rule: any live session (stolen cookie) dies with the old password. Single-use: reusing a consumed token returns the generic "invalid or has expired".
- **Never throws, never blocks:** every send goes through `sendEmailSafe`. A transport failure logs `[email] send failed` and cannot fail an order, webhook, registration or status change. Email hooks are also ordered *after* commit (checkout) or *after* the CAS win (webhook) — mail never describes a state that didn't happen.
- **Webhook mail is CAS-gated:** `if (claimed.count === 1) await emailPaymentResult(...)` — exactly three such guards (source-guarded). The late-payment-after-cancel edge stays silent (the state machine already logged CRITICAL).
- **Dev-log mode is checked per call**, not at import; `ensureResend()` throws if called without a key (defensive — callers check the mode first). The Resend module is loaded via dynamic import only, so no suite ever constructs a client at module load.
- **Tests are hard-pinned to dev-log:** `tests/setup/env.ts` overwrites `RESEND_API_KEY` in every worker — a real key in `.env` can never leak into a suite. The `email-hooks` suite mocks `@/lib/email` entirely and asserts *who* gets mail, never rendering (unit templates own rendering).
- **Rate limit semantics:** first 5 requests per address succeed, the 6th is refused ("Too many reset requests…") within the 15-minute window (`isRateLimited` blocks once `count >= 5`). Buckets are per-process, same as login throttling (§8).

### 22.4 Tests & gate

- Unit **252 → 283** (18 files): new `tests/unit/email-ops.test.ts` (**23**) — dev-log mode matrix (absent / `ci-placeholder` / real key), dev-log output, `sendEmailSafe` swallows transport failure (mocked `resend` rejecting), template content (subjects, `Rs. 1,000.00`, `20 Sept 2026`, pay-on-delivery vs Safepay copy, per-status subjects, refund-vs-no-refund cancel copy, welcome/reset links, every builder ships subject+html+text), source guards (lazy `await import("resend")` and **no static import**, all four hooks call `sendEmailSafe`, order-received after `revalidatePath`, exactly **3** `claimed.count === 1` gates, `EMAILED_STATUSES` = exactly SHIPPED/DELIVERED/CANCELLED, `recordFailure` **before** `findFirst`, single generic success **after** the send, `sessionVersion` bump + token `deleteMany`, 1-hour TTL, login links to `/forgot-password`). Plus `client-forms-guard` **+8** (the two new forms × 4 guards).
- Integration **221 → 246** (32 files): new `tests/integration/password-reset.test.ts` (**13**) — hashed 1-hour token row, identical known/unknown responses (+ unknown stores nothing), case-insensitive match, newest-link-wins, malformed email field error, 5-then-refused rate limit, successful reset (password rotated both ways, `sessionVersion +1`, tokens consumed), unknown/expired/reused token refusals with unchanged session, confirm-mismatch, short password, blank token. New `tests/integration/email-hooks.test.ts` (**12**, transport mocked) — webhook confirmed exactly-once (+ duplicate delivery silent), failed-once, refunded-once, unknown order silent; status flow quiet through CONFIRMED/PROCESSING then SHIPPED/DELIVERED mailed, unpaid cancel promises no refund, paid-Safepay cancel issues refund first then mails "refunded", duplicate same-status click silent; register → welcome to the right address; known-address reset link vs unknown sends nothing; second request replaces the link **and** the live hash.
- Gate: `npm run test` **529/529** (283 unit / 18 files + 246 integration / 32 files) · `tsc --noEmit` clean · `eslint .` **0/0** · `prisma validate` + `migrate status` (**9**, +`phase14_password_reset`) · `npm run build` green (+`/forgot-password`, +`/reset-password` routes) · **smoke 19/19 + E2E 229/229** (section 18 = 17 new checks: both pages render, missing-token invalid message, request → one sha256 row, unknown address byte-identical + zero rows, hand-crafted token renders the form, reset succeeds → old password dead/new one live/`sessionVersion +1`/tokens consumed, reuse and unknown token refused, new password signs in with session cookie, old password rejected with none) on the new build (server pid 21611, `ss`-verified) · post-run leftover query **0** (tokens, e2e users, stray orders).

### 22.5 Manual browser checklist (needs a human; server on `:3100`)

1. `/login` → "Forgot password?" next to the Password label → `/forgot-password` renders the request form.
2. Submit a **known** email → the generic "If that address has an account…" status message, and the server console prints `[email] dev-log → to=… subject="Reset your Girah password"`.
3. Submit an **unknown** email → byte-identical message, **no** log line, no token row (`npx prisma studio` → `PasswordResetToken` empty).
4. Fire a 6th request for one address inside 15 minutes → "Too many reset requests — please wait a few minutes and try again."; wait it out or change address.
5. Open the link from the dev-log line → new-password form; mismatched confirm → `role="alert"` field error; success → redirected to `/login`; the **old** password now fails and the new one signs in (any session that existed before the reset is dead).
6. Reuse the same link → "This reset link is invalid or has expired."; `/reset-password` with no `?token=` → same invalid message.
7. Place a COD order → `[email] dev-log` "Order received"; pay a Safepay order → "Payment confirmed"; admin marks SHIPPED → "Your order has shipped"; register a new account → "Welcome to Girah". Duplicate webhook deliveries (re-POST) must not double-mail.
8. Cancel a **paid** Safepay order → cancel mail says the payment **was refunded**; cancel an unpaid one → "any due refund is on its way", no refund claim.

### 22.6 Errors hit in Phase 14 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | Python edit script `AssertionError` appending the reset actions — no write happened | anchored on `'  await signOut(…)\n}\n'` but the file ends **without** a trailing newline after the last `}` | re-anchored on the exact last two lines (`await signOut…` + `}`) and appended; verified with `tsc` after |
| 2 | `tsc` TS2352: `typeof import("resend")` not assignable to `{ default: … }` — "Property 'default' is missing" | resend v6 exports a **named** `Resend`, there is no default export | `mod as { Resend: new (apiKey: string) => ResendLike }` |
| 3 | Unit: `expected … to contain '20 Sep 2026'` | `formatDate` uses `en-GB`, where September's short month is **"Sept"** (§8's documented format is "26 Sept 2026") — my assertion used the US "Sep" | assertion corrected to `20 Sept 2026` (formatter untouched) |
| 4 | Unit: `expect(mail.to).toBe("a@b.c")` failed in the "every builder" loop | order-mail fixtures use `buyer@girah.test`; only welcome/reset use `a@b.c` | asserted `to` is non-empty (per-builder recipients are asserted where they matter) |
| 5 | `vitest run tests/integration/…` → "No test files found … include: tests/unit/**" | integration files need `vitest.integration.config.ts`; the default config only includes `tests/unit` | run via `npx vitest run --config vitest.integration.config.ts <files>` (or `npm run test:integration`) |
| 6 | ESLint **1 warning** (gate is 0/0): unused `bcrypt` in `email-hooks.test.ts` | copied the import from `password-reset.test.ts`, where it is used | removed |
| 7 | Draft `email-hooks` tests would fail: PENDING→SHIPPED rejected, paid-Safepay cancel refused | `ALLOWED_TRANSITIONS` needs the full chain; the refund branch refuses without `safepayTracker` **before** any state/email | chained CONFIRMED→PROCESSING→SHIPPED; seeded `safepayTracker` on the paid order |
| 8 | `register` in `email-hooks` would call real `signIn` outside a request | the suite had no `@/lib/auth` double (account-actions does) | added the `vi.mock("@/lib/auth", …)` block with `signIn`/`auth` stubs + empty `handlers` (so `readSessionFromCookieJar` fails closed to `null`) |

### 22.7 Decisions recorded

- Dev-log-only (decision ①): no `resend` API call exists anywhere in test/CI paths — `tests/setup/env.ts` pins `ci-placeholder` for every worker, and CI already injects the placeholder (ci.yml).
- Scope of mail (decision ②) is enforced by source guards: exactly 3 webhook sites (CAS-gated), 1 checkout site, `EMAILED_STATUSES` = SHIPPED/DELIVERED/CANCELLED, 1 welcome, 1 reset. `markCodPaymentReceived` / `refundOrderPayment` stay silent on purpose.
- `"use server"` purity held: schemas live in `schema.ts`, templates/transport are plain modules (unit-importable), actions in `actions.ts` — `sha256`/TTL constants are **non-exported** helpers inside the action file (lint-clean).
- New dependency `resend@^6.30.0` is **lazy** — no import-time construction, so the decision-① fallback and suite safety are structural, not convention.
- Manual checklists stay deferred to the end (user directive): §22.5 joins the owed list with §14.5–§21.5 — one pass after Phase 16.

---

## 23. Phase 15 — wishlist + dedicated /search page — detailed log (what & why)

Scope: per-account wishlist (model + module + `/wishlist` page + heart controls on every product card and the product panel) and a dedicated `/search` results page, with the header/mobile search forms retargeted from `/shop`. Migration 9 → **10** (`WishlistItem`). No new dependencies.

### 23.1 Decisions (from the Phase 14+15 plan, §22.1)

1. **Products only; header form → `/search`** (decision ③): the header and mobile-menu GET forms post to the new results page; `/shop` **keeps** its inline search + full filter set (CategoryTabs/ShopFilters untouched).
2. **Guests see hearts but are refused by the action** — "You must be signed in." — while the `/wishlist` **page** is proxy-gated to `/login?callbackUrl=/wishlist` (same treatment as `/account`).
3. **No guest wishlists, no share/price-drop alerts, no wishlist count badge** (recorded non-goals).

### 23.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | No storage for saved products | Migration `phase15_wishlist`: `WishlistItem {id, userId FK cascade, product FK cascade, createdAt, @@unique([userId, productId]), @@index([userId])}` + back-relations on `User`/`Product`; added to the `resetDb` TRUNCATE list | `prisma/schema.prisma`, `prisma/migrations/20260927045147_phase15_wishlist`, `tests/setup/helpers.ts` |
| 2 | Card shape was mapped inline inside `getProducts` only | Extracted **`toProductListItem`** + **`CARD_PRODUCT_INCLUDE`** (APPROVED-only ratings, first image, enabled-variation pricing) in the catalog queries; `getProducts` now `products.map(toProductListItem)`; both exported through the barrel so other modules can produce byte-identical cards | `src/modules/catalog/{queries,index}.ts` |
| 3 | No wishlist module | New `src/modules/wishlist/`: **`actions.ts`** (`"use server"`, one export) — `toggleWishlist(productId)`: `auth()` first → guest refusal → empty-id guard → toggle on the `userId_productId` unique pair (`deleteMany` for removal; create races P2002 → `{added:true}`, P2003 → "Product not found."). **`queries.ts`** (plain, auth-first) — `getWishlistProducts()` (card shape via the shared mapper, newest save first) and `getWishlistProductIds()`; both return `[]` for guests and always scope by `session.user.id`. Barrel re-exports actions + types + queries | `src/modules/wishlist/{actions,queries,index}.ts` |
| 4 | No heart UI | **`WishlistButton`** (client, ToggleActiveButton pattern): optimistic pending state, `aria-pressed`, `aria-label` "Add/Remove from wishlist", `role="alert"` error bubble (guests get "You must be signed in."), `router.refresh()` on success. **`ProductCard`** restructured: the card is wrapped in `relative` div, heart absolutely top-right **outside the `<Link>`** (a `<button>` inside an anchor is invalid and would navigate instead of toggling); new optional `wishlisted` prop. **`PurchasePanel`** takes `wishlisted` and renders a `size="lg"` heart beside the title | `src/components/storefront/{WishlistButton,ProductCard,PurchasePanel}.tsx` |
| 5 | `/wishlist` did not exist | New page under `(storefront)`: page-level `redirect("/login?callbackUrl=/wishlist")` (defense in depth over the proxy), saved-count `role="status"` line, empty state ("No saved items yet" + Browse link), grid of `ProductCard … wishlisted`; proxy matcher += `/wishlist/:path*` with the same guest bounce as `/account` | `src/app/(storefront)/wishlist/page.tsx`, `src/proxy.ts` |
| 6 | Search only existed as an inline `/shop` filter | New `/search` page: awaited `searchParams` → `getProducts({search, sort, minPrice, maxPrice, inStockOnly})` (everything through `sanitizeFilters` — no raw query reaches Prisma), `Results for "x"` h1, single-expression `countLabel` (avoids React's SSR text-node `<!-- -->` splits), refine form, `SortSelect basePath="/search"`, no-matches empty state, grid with per-card heart state | `src/app/(storefront)/search/page.tsx` |
| 7 | Header/mobile posted to `/shop`; SortSelect hardcoded `/shop`; nav had no wishlist entry | Both forms → `action="/search"` (comment explains the split with the inline shop search); `SortSelect` gained `basePath` (default `/shop` — shop behaviour byte-identical); Header nav + `menuLinks` gain a **Wishlist** entry only when signed in (no dead links for guests); every `ProductCard` page (home, shop, search, wishlist, product detail incl. related) fetches `getWishlistProductIds()` once and passes `wishlisted={wished.has(id)}` | `src/components/shared/{Header,MobileMenu}.tsx`, `src/components/storefront/SortSelect.tsx`, 5 page files |
| 8 | Nothing guarded the new surface | Unit `wishlist-search` (**18**: module boundaries, auth-before-db order, P2002/P2003, proxy matcher, heart-outside-Link, header/menu/sort retarget, page guards, single shared mapper); integration `wishlist` (**11**: guest refusal, add/remove idempotence, missing product, unique-pair race, card shape + ordering, cross-account isolation, guest `[]`, cascade on product **and** user delete); shell/reviews guards re-aimed; smoke +2; E2E **section 19** (19 checks) + 3 new `requiredActions` | `tests/`, `scripts/{smoke,e2e}.mjs` |

### 23.3 Behaviour worth knowing before touching this code

- **The heart never lives inside the card `<Link>`.** `ProductCard` wraps everything in a `relative` div; the button overlays top-right. Re-nesting it inside the anchor would both be invalid HTML and turn every toggle into a navigation.
- **Toggle = unique-pair dance, not an upsert.** Read → delete (`deleteMany`, race-safe) or create → P2002 swallowed as `{added:true}` (our own double-click already created it), P2003 → "Product not found." The `(userId, productId)` uniqueness is the whole idempotence story — do not replace it with a plain create.
- **Every read is auth-first AND session-scoped.** Queries hard-fail closed for guests (`[]`) and always filter `userId: session.user.id` — no parameterised userId anywhere, so no query can be pointed at another account.
- **Card shape has ONE owner.** `toProductListItem`/`CARD_PRODUCT_INCLUDE` in the catalog module (APPROVED-only ratings, enabled-variation min price, "out of stock only when every variation is unavailable"). The wishlist maps through it — never re-implement the mapping (the unit suite counts `approvedRatings.reduce` occurrences to prove it).
- **Search never touches Prisma directly** — `getProducts` → `sanitizeFilters` (whitelist sort, trimmed ≤100-char search, rounded paisa). `/shop` keeps its inline form on `/shop` with hidden filter preservation; only the header/mobile forms moved.
- **SSR text escaping:** React escapes `"` to `&quot;` in text nodes (and splits adjacent expressions with `<!-- -->`). The count line is deliberately ONE template expression, and the E2E matchers assert `&quot;` (same trap as §21.6 #5).
- **Proxy and page both gate `/wishlist`** — an anonymous fetch is bounced by the matcher (`/wishlist/:path*`) before the page renders; the page-level `redirect` covers contexts that skip middleware.
- **Guests still render hearts on public pages** (`getWishlistProductIds()` → `[]` → outline heart); clicking runs the action, which refuses them — the page never pretends a guest has a wishlist.

### 23.4 Tests & gate

- Unit **283 → 301** (19 files): new `tests/unit/wishlist-search.test.ts` (**18**) — `"use server"` export rules (async-only, `export type`), `auth()` strictly before any `db.wishlistItem`, guest message, unique-pair + P2002/P2003, auth-first queries + session scoping + shared mapper, barrel surface, proxy matcher/gating, heart-outside-Link ordering, rating guard preserved, panel's large heart, header/menu `action="/search"` (and no `/shop` form), `SortSelect` basePath default + template push, `/search` page (heading/count/getProducts/no raw db), `/shop` keeps inline form + filters, `/wishlist` redirect/empty-state/marks cards, all five card pages pass heart state, mapper single-implementation counts, barrel exports. Plus re-aimed guards: `storefront-shell` header+mobile → `/search` (2), `reviews` APPROVED guard → `CARD_PRODUCT_INCLUDE`.
- Integration **246 → 257** (33 files): new `tests/integration/wishlist.test.ts` (**11**) — guest refusal + zero rows, add→remove cycle (one row, never duplicates), missing product, empty id, unique-pair duplicate rejects, card shape + newest-first ordering, cross-account isolation for both queries, guest `[]` ×2, cascade deletes (product gone → rows gone; account gone → rows gone, product survives).
- Gate: `npm run test` **558/558** (301 unit / 19 files + 257 integration / 33 files) · `tsc --noEmit` clean · `eslint .` **0/0** · `prisma validate` + `migrate status` (**10**, +`phase15_wishlist`) · `npm run build` green (+`/search`, +`/wishlist` routes) · **smoke 21/21 + E2E 251/251** (section 19 = 19 new checks: heading with `&quot;`, product in grid, single-product count, heart wiring, no-matches state, bare page, sort param, shop inline form intact, guest refusal, signed-in add + DB row, anon `/wishlist` bounce with encoded callback, signed-in render + `aria-pressed="true"` + saved-count, other account sees nothing, remove + row gone, empty state — plus 3 new `requiredActions`: `requestPasswordReset`, `resetPassword`, `toggleWishlist`) on the new build (server pid 14479, `ss`-verified) · post-run leftover query **0** (wishlist rows, tokens, e2e users, stray orders).
- Regression watch held: `catalog-filters`, `client-forms-guard`, `reviews`, `storefront-shell`, `account-actions`, `webhook`, `email-hooks`, `password-reset` all green.

### 23.5 Manual browser checklist (needs a human; server on `:3100`)

1. Header search (and the hamburger menu's search) → `/search?search=…` shows `Results for "…"`, the count line, sortable grid; nonsense query → "No matches" with the query echoed.
2. `/shop` still filters inline (search box, category tabs, price/stock filters, sort) — its form still posts to `/shop`.
3. Signed out: hearts render outline everywhere; clicking one → `role="alert"` "You must be signed in."; `/wishlist` → `/login?callbackUrl=/wishlist`, and after login lands back on the wishlist.
4. Signed in: heart a product from the shop grid and from the product page (large heart by the title) → heart fills (`aria-pressed="true"`), `/wishlist` lists it with "1 saved item"; un-heart it → row disappears, empty state returns.
5. Two accounts: items saved in account A never appear in account B's `/wishlist`.
6. Header nav shows **Wishlist** only when signed in (guests see Shop/Sign In/Cart only).
7. Delete a product (admin) that someone had wishlisted → the row disappears with it; wishlist the deleted product id → "Product not found."

### 23.6 Errors hit in Phase 15 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | Edit script `AssertionError` while restructuring `ProductCard` — nothing written | my earlier read of the file stopped at line 60; the card also ends with a "View →" span the anchor didn't include | rewrote the whole file (wrapper div + heart) instead of a fragile tail splice |
| 2 | `tsc`: `Cannot find name 'getWishlistProductIds'` + a cascade of implicit-any errors in the product page | the import replacement targeted a single-line import that is actually multi-line | inserted the import against a stable anchor (`ProductGallery` import) |
| 3 | `reviews` guard failed: `expected … to contain 'reviews: { where: { status: "APPROVED" }'` | the include block moved into `CARD_PRODUCT_INCLUDE` and gained `as const` for `satisfies Prisma.ProductInclude` | re-aimed the guard at the single owner (`status: "APPROVED"` + `CARD_PRODUCT_INCLUDE` present) — intent (APPROVED-only) unchanged |
| 4 | My own mapper guard failed: `approvedRatings.reduce` still in `queries.ts` | the assertion assumed the old inline block, but the extracted mapper legitimately contains it | assert **exactly one** occurrence of `approvedRatings.reduce` and of `products.map(` — single implementation, not absence |
| 5 | E2E: heading + count checks failed despite status 200 | React SSR escapes `"` → `&quot;` in text nodes (same family as §21.6 #5) | matchers assert `Results for &quot;…&quot;` / `1 product matching &quot;…&quot;` |
| 6 | First draft of the no-matches E2E check contained `includes(…) === false &&` (inverted) | sloppy compound condition written in one pass | simplified to `No matches` + raw query substring |
| 7 | Two unit-guard typos caught pre-run (`wishlistButton productId` lower-case; a convoluted export regex) | copy/paste + over-correct regex | `WishlistButton productId={product.id}`; guards are now simple `not: export const` / `not: export function` |
| 8 | Phase 14's server (pid 21611) was gone and port 3100 had no listener at F2 | the background process did not survive the interrupted CI-watch session | started a fresh `nohup npx next start -p 3100` (pid 14479) and re-verified with `ss` before smoke/E2E |

### 23.7 Decisions recorded

- Decision ③ executed literally: header + mobile → `/search`, shop inline stays `/shop` (both asserted in unit guards AND E2E — neither may drift).
- Wishlist is **users-only, no badge, no sharing** (§23.1 non-goals); the nav link appears only for signed-in users so guests never hit a dead end.
- Heart placement outside the `<Link>` is a **structural** constraint, not styling — the unit suite asserts `</Link>` precedes `<WishlistButton>` so a future refactor can't silently re-nest it.
- The catalog mapper extraction (touching `getProducts`) was accepted as necessary: two implementations of the card shape would drift (ratings/pricing rules), and `catalog-filters`/`reviews` stayed green through the change.
- Manual checklists §22.5 + §23.5 join the deferred list (user directive): one pass after **Phase 16**.
- No new dependencies in either phase — `resend` (Phase 14) was the only addition, and it is lazy-loaded.

---

## 24. Phase 16 — design & polish (the original design doc, applied) — detailed log

Scope: apply `initial design/claude.md` (the original GPT design spec) as **applied design** across the storefront, with zero feature downgrades. **No schema change** (migrations stay at 10), **no new routes**, **no new runtime dependencies** (rembg ran in a throwaway `/tmp` venv), **no invented content** (no About/FAQ/Contact pages, no fabricated Instagram posts or shipping FAQs).

### 24.1 Decisions (user-confirmed before execution)

1. **Florals = rembg AI background removal** (①): the 6 `assets/product-photos/*` images were cut out via `scripts/cutouts.py` (rembg, alpha-bbox trimmed) → committed as `public/florals/*.png`. The soft-mask fallback was not needed.
2. **About/FAQ/Contact/Privacy/Terms skip this phase** (②): nav/footer link only existing routes — the do-not-invent-content rule wins over the design doc's link list.
3. **Instagram showcase is gated** (③): renders only when `NEXT_PUBLIC_INSTAGRAM_URL` is set **and** tiles exist in `public/instagram/` — no fake posts. Same gate for WhatsApp/email socials (`NEXT_PUBLIC_WHATSAPP_URL`, `NEXT_PUBLIC_CONTACT_EMAIL`, added to `.env.example`).
4. **Trust strip kept** (④): not in the design doc, but shipped in Phase 9 — restyled quiet on cream instead of removed.
5. **Product accordions = DESCRIPTION + DETAILS only** (⑤): no invented shipping/care/returns copy. The near-ATC line "Free shipping on all orders." was verified true first (`Order.shipping @default(0)` — checkout shows FREE).
6. **Standing no-downgrade rule**: wishlist, header search, card star ratings (a Phase 10 guarantee enforced by unit + E2E), the admin revenue chart and forgot/reset password all stay. The design doc's "no ratings on cards" note was overridden by this rule.

### 24.2 Changes

| # | Problem | Fix | Where |
|---|---------|-----|-------|
| 1 | No transparent florals for editorial layouts | `scripts/cutouts.py` (rembg, CPU) maps 6 sources → `public/florals/{sunflower,sunflower-02,sunflower-03,lily,duck,duck-01}.png`; the whole `public/` dir was previously untracked and is now committed (CI E2E serves these files) | `scripts/cutouts.py`, `public/florals/` |
| 2 | Design-doc tokens missing (motions, spacing, focus) | `globals.css`: `--dur-fast/standard/comfort/editorial` (150/250/400/700ms), `--ease-ui/media/organic`, spacing `--space-1..12` (4→120px), `--container-max: 1280px`, `--header-h-desktop/mobile` (80/64), global `:focus-visible` sage outline, global `prefers-reduced-motion: reduce` kill-switch, **`--color-muted: #6F786F → #656E65`** (contrast, §24.7) | `src/app/globals.css` |
| 3 | Header/menu/footer were Phase 9's shell, not the spec's | **Header** rewritten (h-16 md:h-20 = 64/80, Playfair wordmark, primary nav Home/Shop/[Wishlist when signed in]/account, `action="/search"` form kept, CartBadge); **MobileMenu** rewritten as a full-screen cream overlay (`fixed inset-0 z-50`, `role="dialog"` + `aria-modal`, Escape, body-scroll lock, focus-on-open, primary/secondary groups + search); **Footer** rewritten (cream, wordmark + "Handmade pieces, made to be cherished.", SHOP/ACCOUNT columns linking only live routes, gated social row, `© {year} Girah` + trust line) | `src/components/shared/{Header,MobileMenu,Footer}.tsx` |
| 4 | Homepage was the Phase 9 editorial, not the design doc's | New `src/components/storefront/home/{Hero,MagazineGrid,ImmersiveBouquet,ClosingCta,InstagramShowcase}.tsx`; `page.tsx` rewritten (hero → magazine → featured trio `FIND SOMETHING TO CHERISH` `slice(0,3)` with 01/02/03 → trust strip restyled → scroll-driven immersive → closing CTA → gated Instagram); categories section **removed**, `getWishlistProductIds` kept; `Button` BASE gained `uppercase tracking-[0.02em]`; `ProductCard` gained `priority` (first home card = LCP) with the star rating **restored** | `src/app/(storefront)/page.tsx`, `home/*.tsx`, `src/components/ui/Button.tsx`, `ProductCard.tsx` |
| 5 | Product page had no accordions or post-ATC drawer | New **`Accordion`** (`aria-expanded`/`aria-controls`, +/−, `border-t` dividers) and **`MiniCartDrawer`** (`role="dialog"`, Escape, backdrop, scroll lock, `role="status"` totals, View Cart/Continue Shopping, desktop right drawer / mobile bottom sheet); **`PurchasePanel`** rewritten: DESCRIPTION (open) + DETAILS accordions, free-shipping line, `aria-pressed` variation buttons, IntersectionObserver mobile sticky ATC (`lg:hidden`), success opens the drawer, `role="alert"` error feedback | `src/components/storefront/{Accordion,MiniCartDrawer,PurchasePanel}.tsx` |
| 6 | Spec copy missing across the funnel | Copy passes: cart (empty-state verbatim + uppercase CTAs + 20px Total), checkout h1, confirmation (sage glyph, `Total:` prefix, uppercase links — its Phase 3 state-machine messages kept), LoginForm/RegisterForm, account dashboard (bordered 2×2 blocks: Orders/Profile/Saved Shipping/**Wishlist**), profile/addresses/orders h1s `+= uppercase`, shop intro "Discover handmade pieces, made with care." + uppercase empty states + Clear Search/Clear Filters, 9 form files `+= uppercase tracking-[0.02em]` | cart/checkout/confirmation/shop/search/account pages, 9 form components |
| 7 | No structured data | JSON-LD: product page (`Product` + `aggregateRating` + PKR `offers` + Brand Girah), home (`WebSite` + `Organization` `@graph`), shop (`BreadcrumbList`) | `product/[slug]/page.tsx`, `page.tsx`, `shop/page.tsx` |
| 8 | Nothing guarded the new surface | New `tests/unit/design-phase16.test.ts` (**33**: floral assets, tokens, reduced-motion, homepage copy/single-h1/sections, gated Instagram, header/menu/footer wiring, accordions/drawer, spec copy, JSON-LD shapes); two guards re-aimed — `storefront-shell` homepage `getCategories` → `getWishlistProductIds`, `wishlist-search` header wishlist link now `href: "/wishlist"` (nav config object); E2E **section 20** (**28** checks) | `tests/`, `scripts/e2e.mjs` |

### 24.3 Behaviour worth knowing before touching this code

- **Header height is 64px mobile / 80px desktop** (`h-16 md:h-20`, matching `--header-h-*` in CSS). The mobile menu is a full-screen overlay, not a dropdown — it holds its own copy of the search form (still `action="/search"`).
- **`ImmersiveBouquet` is the only client component on the homepage** (scroll-driven `--bouquet-scale`); everything else is server-rendered. The global reduced-motion rule parks the scrub and any marquee.
- **`InstagramShowcase` returns `null`** unless the env var is set — the E2E asserts `FOLLOW GIRAH` is **absent**, so adding a real showcase must add the env/tiles together.
- **The mini-cart drawer only exists in client state after a successful ATC.** E2E is HTTP-level (`callAction`), so the drawer can never break those tests — its behaviour is unit-guarded + manual (§24.5).
- **Card star ratings are contract, not styling**: `reviews`/`wishlist-search` unit guards and the E2E "shop card shows the star line after approval" prevent a future design pass from removing them (§24.7 ①).
- **`--color-muted: #656E65` is a deliberate deviation** from the spec's `#6F786F` (4.30:1 on cream fails AA; 656E65 measures 4.98/4.52) — the reason is a comment in `globals.css`.
- **E2E "exactly one `<h1>`" and "exactly two `>Shop Handmade</a>`" depend on counting *rendered* HTML**: the RSC flight payload inside inline `<script>`s duplicates text nodes (same trap family as the `&quot;` escapes). Always strip scripts (`visibleHtml`) or count markup anchors.
- **Florals are served through `next/image`** (`/_next/image?url=%2Fflorals%2F…`), so assert on the substring `florals`, not `src="/florals/…"`. The raw file still resolves 200 directly.
- **`initial design/` must never be committed** — always `git add -A -- . ':!initial design'`.

### 24.4 Tests & gate

- Unit **301 → 334** (20 files): new `tests/unit/design-phase16.test.ts` (**33**) — florals exist + SVG boilerplate guard untouched, token presence (motion/spacing/header dims), reduced-motion + focus-visible, homepage locked copy + single h1 + sections + gated IG, header/menu/footer (no dead links, gated socials), accordion/drawer presence + aria, spec copy across cart/checkout/confirmation/auth/account/shop/search, JSON-LD shapes; plus the two re-aimed guards noted in §24.2 row 8.
- Integration **257** (33 files) — unchanged: Phase 16 touched no data layer.
- Gate: `npm run test` **591/591** (334 unit / 20 files + 257 integration / 33 files) · `tsc --noEmit` clean · `eslint .` **0/0** · `prisma validate` + `migrate status` (**10**, unchanged — no migration) · `npm run build` green (routes unchanged, +0) · **smoke 21/21 + E2E 279/279** (section 20 = 28 new checks: locked hero copy/subtext, old copy gone, single h1, hero-CTA count, magazine/closing copy, old sage band + category chips gone, trust strip, immersive hook + message, gated Instagram, WebSite JSON-LD, footer brand sentence + no dead links, Home nav, florals served, open Description accordion, free-shipping line, `aria-pressed`, product JSON-LD, shop intro + BreadcrumbList, login guest hatch, account blocks) on the new build (server pid 28041, `ss`-verified) · post-run leftover query **0** (wishlist rows, tokens, e2e users, stray orders, e2e products).
- Regression watch held: `catalog-filters`, `client-forms-guard`, `reviews`, `storefront-shell`, `wishlist-search`, `account-actions`, `webhook`, `email-hooks`, `password-reset` all green.

### 24.5 Manual browser checklist (needs a human; server on `:3100`)

1. **Homepage**: hero florals layered on cream, exactly one `h1`, "Shop Handmade" (hero + closing) → `/shop`; magazine 60/40 grid with layered florals; trust strip quiet on cream; immersive bouquet scrubs on scroll (**and does not** with OS reduced-motion on); closing CTA; **no** Instagram section while `NEXT_PUBLIC_INSTAGRAM_URL` is unset (set it + drop tiles into `public/instagram/` to see it).
2. **Header**: 80px desktop / 64px mobile; hamburger → full-screen cream menu; Escape/backdrop close; body scroll locked while open; search posts to `/search`; **Wishlist** nav entry only when signed in.
3. **Footer**: brand sentence, SHOP/ACCOUNT columns link only live routes; socials appear only when the three env vars are set; `© 2026 Girah`.
4. **Product page**: Description open / Details closed (±, `aria-expanded`), free-shipping line, variation buttons toggle `aria-pressed`, ATC success → mini-cart drawer (right on desktop / bottom sheet on mobile, Escape + backdrop close, totals in `role="status"`); mobile sticky ATC bar slides in when the main ATC scrolls off-screen.
5. **Copy sweep**: cart empty state, checkout h1, login/register (`WELCOME BACK`-style uppercase via CSS), account 2×2 blocks incl. Wishlist, shop intro + "No matches" empty state, confirmation `Total:` line.
6. **View-source**: JSON-LD on `/`, `/shop`, and a product page.
7. Then walk the deferred checklists from earlier phases in the same sitting: **§14.5, §15.5, §17.5, §18.5, §19.5, §20.5, §21.5, §22.5, §23.5**.

### 24.6 Errors hit in Phase 16 & fixes

| # | Error | Cause | Fix |
|---|-------|-------|-----|
| 1 | E2E crash: `ReferenceError: productPath is not defined` at section 20 | `productPath` was a `const` inside section 14's block scope, invisible to section 20 | build the URL inline: `` get(`/product/${fixtureProduct.slug}`) `` |
| 2 | Section-20 check failed: CTA count was **4**, expected 2 | the RSC flight payload in inline `<script>`s duplicates every text node | count `>Shop Handmade</a>` (rendered anchors only) — same family as the `&quot;` trap |
| 3 | The crash skipped E2E's in-script cleanup → orphans blocked a clean leftover state (4 e2e products, 2 e2e users, and **99** stray orders accumulated across earlier phases' runs) | cleanup only runs when the script reaches the end | one-off sweep `/tmp/opencode/e2e-sweep.js` (not committed); FK order matters — orders → adjustments → carts → reviews-by-doomed-user → tokens → wishlists → users → products; narrowed the doomed-user set so `dev-customer`'s seed review survives; then a full rerun |
| 4 | Sweep died: `23001 … Review_userId_fkey RESTRICT` on `user.deleteMany` | the blanket `text startsWith "E2E"` review filter didn't match every review owned by doomed users | fetch doomed user ids first, `review.deleteMany({ userId: { in } })`, then delete the users |
| 5 | `Cannot find module '@prisma/client'` running the sweep | the script lives in `/tmp`, outside the project | run with `NODE_PATH=<repo>/node_modules` |
| 6 | Two self-inflicted unit-guard failures (a comment contained the word "Shipping"; the search-empty assertion assumed quoted markup) | over-broad literal matching against source | narrowed the comment assertion; search asserted by the literal `No matches` |
| 7 | Each rembg cutout took ~3 min (CPU onnxruntime) | no GPU in this environment | acceptable for a one-off asset pipeline; `scripts/cutouts.py` is committed so the PNGs are reproducible |

### 24.7 Decisions recorded

- **Card star ratings stay** — the no-downgrade rule overrides the design doc's "no ratings on cards"; both a unit guard and an E2E check now make removal impossible by accident.
- **`--color-muted #656E65` is a documented deviation** from spec `#6F786F` (AA contrast on cream), recorded inline in `globals.css` — do not "restore" the spec value.
- **No About/FAQ/Contact/Privacy/Terms pages** were invented; the nav/footer link only what exists. Revisit only with real content (user directive ②).
- **Instagram stays gated** — three social env vars in `.env.example`, no fabricated posts; the showcase + its socials render only when the owner supplies real assets.
- **DESCRIPTION + DETAILS only** — no invented shipping/returns/care copy; the one shipping claim on the page ("Free shipping on all orders.") was verified against `Order.shipping @default(0)` before being written.
- **Florals are committed** (`public/florals/*.png`, derived from the repo's own `assets/product-photos` via `scripts/cutouts.py`); `public/` was previously untracked — it is now part of the repo because CI's E2E section 20 fetches those files.
- **No schema change, no new runtime dependencies, no new routes** — Phase 16 is presentation-only; rembg ran in a throwaway `/tmp` venv.
- `initial design/` stays uncommitted forever: `git add -A -- . ':!initial design'`.
- The deferred manual pass is now a single sitting: **§14.5–§23.5 + §24.5** (§9).
