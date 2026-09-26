# Girah

Handmade crochet storefront: catalogue and filters, cart, checkout (COD + Safepay online payment), customer account area, and an admin back-office for products, variations, stock, orders and customers.

## Stack

- **Next.js 16** (App Router) + **React 19**, TypeScript
- **Prisma 6** + **Neon Postgres** (serverless driver over WebSockets)
- **NextAuth v5** — credentials provider, JWT sessions, per-account `sessionVersion` invalidation
- **Safepay** sandbox — passport token, hosted checkout, webhook verification, refunds
- **Cloudinary** image hosting, **Tailwind CSS 4**, **Vitest 5**

## Getting started

### 1. Environment

```bash
cp .env.example .env
```

Fill in at minimum `DATABASE_URL` (Neon), `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, and the Safepay/Cloudinary keys. See `.env.example` for comments on each variable.

### 2. Install and prepare the database

```bash
npm install
npx prisma migrate dev   # applies prisma/migrations
npx prisma db seed       # demo catalogue + local test accounts
```

### 3. Run

```bash
npm run dev              # http://localhost:3000
npm run build && npm start
```

## Tests

```bash
npm test                 # unit + integration
npm run test:unit
npm run test:integration
npm run test:watch
```

Tests always run against the **`girah_test`** database — derived from `DATABASE_URL` (or taken as-is from `DATABASE_URL_TEST` in CI) — never the dev/prod database. Integration files run serially and the global setup migrates the test schema.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (must be 0 errors / 0 warnings) |
| `npm test` | Unit + integration suites |
| `npx prisma migrate dev` | Create/apply migrations |
| `npx prisma db seed` | Seed demo data |

## Test accounts (local seed only)

| Email | Password | Role |
|-------|----------|------|
| `dev-admin@girah.test` | `DevAdmin123!` | ADMIN |
| `dev-customer@girah.test` | `DevCustomer123!` | CUSTOMER |

Never reuse these credentials anywhere real, and never run the seed against production.

## Project layout

```
src/app         routes (route groups: (storefront), (auth), account, admin, api)
src/components  UI (storefront/, admin/, shared/)
src/modules     domain modules — accounts, admin, cart, catalog, checkout, orders, payments
src/lib         cross-cutting helpers (db, auth, session, format, rate-limit, …)
prisma          schema + migrations + seed
tests/          unit/, integration/, setup/
```

## Conventions

- **Server actions** validate every input first, then return `{ success, error?, fieldErrors? }` — never trust client numbers or ids.
- **Money** is integer paisa everywhere; format with `formatPrice` from `@/lib/format`. Dates render with `formatDate` (explicit `Asia/Karachi` timezone).
- **Module boundary**: production code imports a module's public API only — `@/modules/<name>` or `@/modules/<name>/actions`. Enforced by ESLint (`no-restricted-imports`); `tests/**` may reach into internals.
- **Authz**: `requireAdmin()` first line of every admin action; live account state (`isActive`, `role`, `sessionVersion`) is re-checked on every request. `src/proxy.ts` gates `/admin/*` and `/account/*` and bounces signed-out visitors to `/login?callbackUrl=…`.

## Status

This repo is mid-way through an 8-phase bug-fix plan: phases 1–7 are complete (security, stock/order integrity, Safepay, accounts/authz, cart/catalog, forms/admin feedback, hygiene), phase 8 (test automation + CI) is pending. The full plan, findings and per-phase logs live in [`contextopencode.md`](./contextopencode.md).
