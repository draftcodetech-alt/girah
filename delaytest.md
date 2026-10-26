# delaytest.md — verification record for the 6-phase refactor

Written 2026-10-26 as the deferred checklist; **executed the same day** — every
suite below was run after the edits and is green (results in §2). Keep it as
the run record; §4 (browser probes) and the `test.md` manual walk are still
manual work.

**Do not deploy until the manual pass is green and the owner says so.**

---

## 0. What changed (scope of this pass)

| Phase | Change | Main files |
|-------|--------|-----------|
| 1 | Customer cancel / Buy again / Print button removed; **Review now** plumbing added | `src/modules/orders/{actions,status-ops,index}.ts`, `src/app/account/orders/**`, deleted `CancelOrderButton.tsx` / `ReorderButton.tsx` / `PrintButton.tsx` |
| 2 | Admin order actions compacted (real `gap-*` row), **Refund** action + UI removed | `src/components/admin/OrderActions.tsx`, `src/modules/admin/orders.ts` |
| 3 | **Stock concept removed entirely** (column, `StockAdjustment`, adjustment UI, low-stock KPI, out-of-stock UI) | `prisma/schema.prisma`, `prisma/migrations/20261025000000_remove_stock/`, `src/modules/{checkout,admin,cart}/*` |
| 4 | Products + Categories + Variations merged into **one Catalog page**; old index routes redirect | `src/app/admin/catalog/page.tsx`, `src/components/admin/CatalogProductRow.tsx`, `src/app/admin/{products,categories,variations,stock}/page.tsx` |
| 5 | **Review now** on DELIVERED orders + star-fill cascade fix in the review form | `src/components/storefront/ReviewForm.tsx`, `src/app/account/orders/**` |
| 6 | Test files updated for the above (locks on removed features) + this file | `tests/**`, `scripts/{e2e,smoke}.mjs` |

Also in the working tree (uncommitted, from earlier in the session): the account
dashboard redesign (`src/app/account/page.tsx`, `tests/unit/design-phase16.test.ts`).

---

## 1. Static checks

```bash
npx tsc --noEmit      # ✅ 0 errors
npm run lint          # ✅ 0 problems (0 errors, 0 warnings)
npx prisma validate   # ✅ schema valid
npx prisma migrate status  # ✅ Database schema is up to date (dev)
```

One gotcha found on the way: a **corrupted `.next/dev/types/routes.d.ts`**
(truncated write — `d": string; }` at line 62) produced 30 bogus syntax errors.
Fix: `rm -rf .next/dev/types` (generated, gitignored) then `npm run build`
regenerates `.next/types`. If tsc suddenly reports `TS1005` inside `.next/`,
do that before believing the errors.

---

## 2. Automated suites (not run yet)

| Suite | Command | Baseline (`ff493d5`) | Result (2026-10-26) |
|-------|---------|----------------------|---------------------|
| Unit | `npm run test:unit` | 536 | ✅ **513 / 513** |
| Integration | `npm run test:integration` | 365 | ✅ **321 / 321** |
| E2E (HTTP) | build + boot :3100, then `npm run test:e2e` | 364 | ✅ **345 / 345** |
| Smoke | build + boot :3100, then `npm run test:smoke` | 23 | ✅ **21 / 21** |
| Type-check | `npx tsc --noEmit` | 0 | ✅ 0 |
| Lint | `npm run lint` | 0/0 | ✅ 0/0 |

### 2.0 What failed on the first run (and how it was fixed)

Spec-lock tests that still pointed at removed features — 17 assertions across
4 files, all fixed in the same pass:

| File | Stale lock | Fix |
|------|-----------|-----|
| `tests/unit/admin-catalog.test.ts` | `revalidatePath("/admin/products")`, nav `href: "/admin/categories"`, product list read `/admin/products/page.tsx` | → `/admin/catalog`, catalog page + `CatalogProductRow`, assert the legacy route `redirect("/admin/catalog")` |
| `tests/unit/client-forms-guard.test.ts` | `VariationRow` required to have a `<form onSubmit>` | dropped from `CLIENT_FORMS` (kept in `FEEDBACK_UI` — it still renders `role="alert"`) |
| `tests/unit/design-phase16.test.ts` | asserted the stock hint `left in stock` exists | flipped to `not.toContain` |
| `tests/unit/frontend-a11y.test.ts` | `adjust-${variation.id}` ids + `Only ${selected.stock} left in stock` / `role="status"` | removed (stock-adjust form gone); now locks `role="alert"` + no stock copy |
| `tests/integration/admin-product-crud.test.ts` | `revalidatePath("/admin/products")` ×2 | → `/admin/catalog` |
| `scripts/e2e.mjs` | read `/admin/categories` + `/admin/products` for the category/product list checks | → `/admin/catalog` |
| `scripts/e2e.mjs` | legacy-route check expected a plain 3xx | Next serves `redirect()` under a streaming shell as **200 + `<meta http-equiv="refresh" content="1;url=/admin/catalog">`** — check now accepts either form |

Totals moved 536→513 (unit) and 365→321 (integration) because whole feature
areas were deleted; E2E went 364→345, where the new catalog / redirect /
review-now checks offset most of the removed cancel, reorder, refund and stock
checks.

### 2.1 In order

```bash
# 1. schema sanity (the migration is hand-written)
npx prisma validate
npx prisma migrate status          # dev DB: 1 pending? no — already applied

# 2. fast suites first
npm run test:unit
npm run test:integration           # serial files; global setup runs `migrate deploy` on girah_test

# 3. build + production server on :3100 (same DB the scripts will hit)
npm run build
DATABASE_URL=<your .env url> npm start &     # default port 3100

# 4. HTTP suites against that server
npm run test:smoke                 # expect 21/21
npm run test:e2e                   # expect ≈345 checks, 0 failures
```

Notes:

- `tests/setup/global.ts` creates + migrates the **`girah_test`** database, so
  the new `20261025000000_remove_stock` migration is applied there on the first
  integration run. Nothing ever writes to dev/prod.
- `npm run test:e2e` / `test:smoke` honour `E2E_BASE_URL` (default
  `http://localhost:3100`) — point `DATABASE_URL` at the same database the
  server uses.
- Both HTTP scripts are self-contained: they create and clean up their own
  users/products/orders. After a green run, leftover rows should be 0
  (`scripts/clean-dev-data.mjs --dry-run` reports leftovers).
- The scripts were **edited, never executed** in this pass. If a check fails on
  a label that references a removed feature, the script edit (not the product
  code) is the first suspect.

### 2.2 What the suites now lock (must pass)

- `action id absent: cancelMyOrder / reorderOrder / adjustStock / refundOrderPayment`
  — these must be gone from the server-action manifest.
- Legacy admin index routes `/admin/products`, `/admin/categories`,
  `/admin/variations`, `/admin/stock` → **302/307 to `/admin/catalog`**, while
  `/admin/products/new` and `/admin/products/[id]` still render 200.
- Dashboard: **no** `Low stock` KPI, **no** `href="/admin/stock"` nav item.
- Order detail/list: **no** `Refund</button>`, **no** `Cancel order`, **no**
  `Buy again`; receipt has **no** `Print receipt` but keeps `print:hidden`.
- `Review now` present only for a `DELIVERED` order, linking
  `/product/<slug>#reviews-heading`; the order number stays the row link.
- Storefront: no stock/OOS copy anywhere; add-to-cart merges with no stock
  ceiling (only the 999 payload cap).
- `User_single_admin` index survives (see §3).

---

## 3. Migration + schema assertions

The migration is hand-written
(`prisma/migrations/20261025000000_remove_stock/migration.sql`) because
`prisma migrate dev` would have dropped the partial `User_single_admin` index
along with the column it doesn't know about. Three things to re-prove:

1. **`User_single_admin` still exists** (the single-owner invariant — a second
   admin must be impossible at the DB level).
2. **`ProductVariation` has no `stock`** column and no `stock_non_negative`
   check.
3. **`StockAdjustment` table is gone.**

Already verified once on the **dev** DB right after applying (recorded here so
you don't have to redo it blind): indexes `User_pkey`, `User_email_key`,
`User_single_admin`; `ProductVariation` columns `id, productId, name, price,
isEnabled`; `StockAdjustment` absent.

Re-check on any database you care about (dev, or `girah_test` after the
integration run):

```bash
node --input-type=module -e "
import { createRequire } from 'node:module';
const require = createRequire(process.cwd() + '/package.json');
require('dotenv').config({ path: process.cwd() + '/.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const url = process.argv[1] ?? process.env.DATABASE_URL;
const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
const idx  = await db.\$queryRawUnsafe(\"SELECT indexname FROM pg_indexes WHERE tablename = 'User' ORDER BY indexname\");
const cols = await db.\$queryRawUnsafe(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'ProductVariation' ORDER BY ordinal_position\");
const tbl  = await db.\$queryRawUnsafe(\"SELECT to_regclass('StockAdjustment') AS t\");
const chk  = await db.\$queryRawUnsafe(\"SELECT conname FROM pg_constraint WHERE conname LIKE '%stock%'\");
console.log('User indexes :', idx.map(r => r.indexname).join(', '));
console.log('Variation cols:', cols.map(r => r.column_name).join(', '));
console.log('StockAdjustment table:', tbl[0].t);
console.log('stock checks  :', chk.length ? chk.map(r => r.conname).join(', ') : 'none');
await db.\$disconnect();
" "<DATABASE_URL>"
```

Expected: `User_single_admin` present · variation columns end at `isEnabled`
(no `stock`) · table `null` · checks `none`.

Also confirm the migration is recorded: `npx prisma migrate status` lists
`20261025000000_remove_stock` as applied (dev) and applies it to `girah_test`
on the next integration run.

---

## 4. Browser probes (visual / interaction — not covered by the HTTP suites)

Use Chrome (local testing is Chrome-only) against `npm run dev` on
localhost:3000, accounts from `test.md` §0. Playwright module for scripting
screenshots: `/home/syed-areeb-kareem/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`
launched with `--channel chrome` (earlier harnesses live in
`/tmp/opencode/shotharness/`).

- [ ] **Admin order actions spacing** — `/admin/orders/<id>`: buttons sit in
      one compact row with an even `gap-3`/`gap-4`; **Mark Paid** is a real
      sage/cream button (not a bare text link); no Refund button; no double
      gap where the refund used to be.
- [ ] **`/admin/catalog` desktop + 1440/768/360** — Products list on top,
      Categories below; clicking a product row expands the editor +
      variations inline; **+ Add Product** → `/admin/products/new`; Images link
      → `/admin/products/[id]`; left nav shows Dashboard · Catalog · Orders ·
      Customers · Reviews · Newsletter (no Stock/Variations/Categories tabs);
      typing `/admin/products` in the address bar lands on `/admin/catalog`.
- [ ] **Storefront buy flow with no stock** — product page has no `In stock` /
      `Only N left` hint and no OOS badge on cards; add to cart, raise the
      quantity well past the old stock number (no refusal), checkout completes
      COD; cart line shows `Unavailable` + dead steppers only when an admin
      disables the variation.
- [ ] **Review form star cascade** — on a product you can review: default all
      gray; hover the 4th star → **4 gold / 1 gray**; click the 3rd → 3 gold /
      2 gray; hover the 1st → 1 gold; leave → stays at the submitted value;
      Tab into the radios shows the sage focus ring; arrow keys move the
      selection **and** the fill. (Root cause fixed: the old CSS lit only the
      selected star, so the fill never swept.)
- [ ] **Review now** — orders list: only the `DELIVERED` row shows the button,
      the order number is still the row's link (no nested interactive);
      detail page: **View receipt** + per-item **Review now** →
      `/product/<slug>#reviews-heading` scrolled to the reviews heading.
      A `PENDING`/`CONFIRMED` order shows neither.
- [ ] **Receipt** — `/account/orders/<id>/receipt` renders the invoice with
      **no Print button**; `Ctrl/Cmd+P` still prints cleanly (page chrome
      hidden by `print:hidden`).
- [ ] **Account dashboard** — the redesigned `/account` blocks render at
      360/768/1440 with no horizontal scroll.

---

## 5. `test.md` sections to walk (edited to match the spec changes)

| `test.md` section | What to re-verify |
|-------------------|-------------------|
| §2 Shop | price-range chips only — **no `[In stock ×]`** chip / filter |
| §4 Product page | no stock hint under Quantity; stepper floor 1, cap 999 (not stock); Details list has no stock noise |
| §5 Cart | no "quantity above stock" refusal; totals update per click |
| §8 Account | no Cancel order, no Buy again, no Print button; **Review now** on delivered only; receipt still prints via the browser |
| §10 Admin | single **Catalog** page (products + categories + variations); no Stock tab/fields; legacy routes redirect; dashboard has no low-stock card; **no Refund button**; action row spacing; cancel-of-PAID still refunds first |
| §14 | automated block — run against the totals in §2 of *this* file |

Full manual walk of `test.md` is still the pre-deploy gate; the table above is
only what this refactor touched.

---

## 6. Sign-off checklist

- [x] `npx tsc --noEmit` → 0
- [x] `npm run lint` → 0 problems
- [x] `npm run test:unit` → **513/513**
- [x] `npm run test:integration` → **321/321** (auto-migrates `girah_test`)
- [x] `npm run build` + `next start -p 3100` → smoke **21/21**
- [x] E2E → **345/345**
- [x] `prisma validate` + `prisma migrate status` → valid / up to date
- [ ] Schema probe (§3) → `User_single_admin` survives, no `stock`, no `StockAdjustment` (verified once on dev at migration time; re-run if in doubt)
- [ ] Browser probes (§4) → all ticked
- [ ] `test.md` manual pass → all ticked
- [x] README test counts updated to the real totals
- [x] Owner says **commit**
- [ ] Owner says **deploy** (still blocked on the manual pass)
