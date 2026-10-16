# Girah — Manual GUI Test Guide

A complete click-through test of the storefront, customer account area, and
admin back-office. Everything is done in a browser against the **local dev
server**, plus a few light technical checks (view-source, DevTools Network,
the dev terminal for emails).

- Tick each box `- [ ]` → `- [x]` as you verify it.
- Every item has an **Expected** line (success) and an **Actual** line —
  paste what you really saw (text, screenshot name, console output).
- Estimated full pass: **2–3 hours**.
- Sections 1–9 work as guest/customer; §10+ needs the admin account.

---

## 0. Before you start

- [ ] Start the dev server (skip if already running):

  ```bash
  npm run dev          # → http://localhost:3000
  ```
  Actual:

- [ ] Keep the **terminal visible** while testing. There is no email provider
      configured locally, so every email prints there as
      `[email] dev-log → to=… subject=…` — including the **password-reset link**
      you'll need in §6.
  Actual:

- [ ] Sign-in accounts (seeded):

  | Role | Email | Password |
  |------|-------|----------|
  | Customer | `dev-customer@girah.test` | `DevCustomer123!` |
  | Admin | `dev-admin@girah.test` | `DevAdmin123!` |

  You'll also register brand-new customers in §6 — use something like
  `test-<timestamp>@example.com`.
  Actual:

- [ ] Read these **expected local behaviours** first so you don't report them
  as bugs (full list in §13):
  - Safepay's hosted checkout opens, but its **webhook can't reach localhost** —
    an online-paid order stays `PENDING`. Cash-on-delivery (COD) is the
    complete local loop.
  - Content pages are just **About + Contact** (Shipping/Returns/Privacy/Terms
    were removed by owner decision — they 404).
  - Contact page is real (mockup port): `syedareebkareem@gmail.com`, Islamabad.
  - Instagram section renders (real URL + real photos configured).
  - Registration is throttled: **10 attempts / 15 minutes per IP**.
  Actual:

---

## 1. Home & site shell

- [ ] Open http://localhost:3000 — page loads with **exactly one `<h1>`**.
  Expected: `Handmade Pieces, Made to Be Cherished.`
  Actual:
- [ ] Announcement bar sits above the header.
  Expected: `Free shipping on all orders · Cash on delivery available`.
  Actual:
- [ ] Hero: headline + "Shop Handmade" CTA → lands on `/shop`.
  Expected: one hero CTA only.
  Actual:
- [ ] Gallery collage ("A little world"), curated collections
  (JUST OFF THE HOOK / FLOWERS THAT STAY / MADE TO MAKE SOMEONE SMILE),
  promise strip, closing CTA, Instagram section (FOLLOW GIRAH + 5 tiles →
  real profile) all render.
  Expected: 3 collection sections with 3 cards each (hidden only if a pool is empty).
  Actual:
- [ ] Header: wordmark, nav (Home / Shop / About / Contact), search field,
  account link, cart badge; **Wishlist** appears only when signed in.
  Expected: signed out → "Sign In", no Wishlist link.
  Actual:
- [ ] Search in the header for `sunflower` → `/search` results page (§3).
  Expected: count label + grid.
  Actual:
- [ ] Footer has SHOP, ACCOUNT, **Information (About, Contact only)** columns,
  newsletter form, social icons (Instagram + Email), payment badges.
  Expected: no dead links (no `/faq`, no `/shipping|/returns|/privacy|/terms`).
  Actual:
- [ ] `© {year} Girah` + handmade line present.
  Actual:
- [ ] Mobile (~360px): hamburger opens a full-screen menu.
  Expected: Escape closes it, focus returns to the trigger, page behind
  doesn't scroll while open, menu has its own search box.
  Actual:
- [ ] Scroll far down → back-to-top button appears → click → smooth return
  to top.
  Expected: appears after ~600px, `aria-label="Back to top"`.
  Actual:
- [ ] Visit a nonsense URL (`/does-not-exist`) → branded 404 with a way back.
  Expected: `Page not found` + Home/Shop links.
  Actual:

## 2. Shop, filters & pagination

- [ ] `/shop` renders the product grid; intro line reads
  "Discover handmade pieces, made with care."
  Expected: grid + `N pieces` count.
  Actual:
- [ ] Product cards show image, name, **Rs. price with 2 decimals**, star line.
  Expected: no `From Rs. 0`, no `Rs. NaN` anywhere.
  Actual:
- [ ] Click a **category tab** → grid filters; URL carries `?category=…`;
  active tab underlined + `aria-current="page"`.
  Expected:
  Actual:
- [ ] Change **sort** → order changes, URL updates (has `aria-label`).
  Expected:
  Actual:
- [ ] Set **price range** + **In Stock** → results narrow; panel keeps values
  after reload; removable **filter chips** appear next to the count.
  Expected: e.g. `2 pieces [Bouquets ×] [In stock ×]`; × removes one filter.
  Actual:
- [ ] Garbage params (`?minPrice=Infinity&maxPrice=NaN`) → page 200, no
  `Rs. NaN`/`Rs. Infinity` chips or prices.
  Expected: full catalogue, no chips.
  Actual:
- [ ] Combine filter + category: both stay applied; category tab links keep
  price filters.
  Expected:
  Actual:
- [ ] **Pagination**: 12 per page, Prev/Next + numbers, current highlighted;
  `?page=999` clamps to the last real page; changing filters from page 2
  resets to page 1.
  Expected:
  Actual:
- [ ] Impossible combo → empty state with **Clear Search / Clear Filters**.
  Expected:
  Actual:
- [ ] Click a **heart** → fills (signed in); persists after reload; signed-out
  click asks to sign in.
  Expected:
  Actual:
- [ ] Mobile: Filters button opens a bottom sheet; Escape closes it, focus
  returns, background locked.
  Expected:
  Actual:

## 3. Search

- [ ] Search `sunflower` → `/search` with results + count like
  `N products matching "…"`.
  Expected:
  Actual:
- [ ] Search `%_%` → "No matches" (symbols are literal, never wildcards).
  Expected: 0 cards, empty state.
  Actual:
- [ ] Search `zzz-no-such-thing-zzz` → "No matches", no pagination.
  Expected:
  Actual:
- [ ] Clearing the field + searching again returns everything.
  Expected:
  Actual:
- [ ] (Light) View-source → `<meta name="robots" content="noindex…">`.
  Expected:
  Actual:

## 4. Product page

- [ ] Open any product — gallery images (+ counter + thumbs), name,
  `From Rs. X` price, description accordion **open** by default.
  Expected:
  Actual:
- [ ] Toggle accordions (±, `aria-expanded` flips).
  Expected:
  Actual:
- [ ] Select each variation — pressed state, price updates; disabled ones
  show struck-through and can't be added.
  Expected:
  Actual:
- [ ] Selecting a variation shows a stock hint under Quantity.
  Expected: `In stock` normally, `Only N left in stock` when N ≤ 3.
  Actual:
- [ ] Stepper: can't go below 1 or above stock.
  Expected:
  Actual:
- [ ] **Add to cart** → **mini-cart drawer** (right on desktop, bottom sheet
  on mobile) with correct line + total; Tab stays trapped inside; Escape or
  backdrop closes it; focus returns; "View Cart" → `/cart`.
  Expected:
  Actual:
- [ ] Mobile: sticky add-to-cart bar appears once the main button scrolls away.
  Expected: name + price + working button, respects safe area.
  Actual:
- [ ] Wishlist toggle works and matches the card heart.
  Expected:
  Actual:
- [ ] (Light) View-source → JSON-LD `@type: "Product"` with price +
  `priceCurrency`.
  Expected:
  Actual:

## 5. Cart

- [ ] `/cart` lists lines (images, variations, steppers, line totals) + Total;
  shipping FREE; empty state shows **"You may also like"** suggestions.
  Expected:
  Actual:
- [ ] Raise quantity above stock → inline refusal, quantity unchanged.
  Expected:
  Actual:
- [ ] Remove a line → disappears; last line → empty state + shop link.
  Expected:
  Actual:
- [ ] **Guest merge**: incognito, add items as guest, log in → items merged
  into the account cart.
  Expected:
  Actual:
- [ ] Header cart badge matches contents.
  Expected:
  Actual:
- [ ] **Checkout** button → `/checkout`; empty cart → bounced to `/cart`.
  Expected:
  Actual:
- [ ] Mobile (360px): no horizontal scrolling with items in the cart.
  Expected:
  Actual:

## 6. Auth: register, login, password reset

- [ ] Signed out, visit `/account` → `/login?callbackUrl=…`; after login you
  return to `/account`.
  Expected:
  Actual:
- [ ] `/register`: empty submit → field-level errors; mismatched
  password/confirm → error, no account.
  Expected:
  Actual:
- [ ] Register fresh (name, unique email, ≥8-char password) → auto signed in,
  header shows Wishlist/account.
  Expected:
  Actual:
- [ ] Same email again → "already associated" error.
  Expected:
  Actual:
- [ ] Log out (account page button) → `/account` bounces to login (session
  dead everywhere).
  Expected:
  Actual:
- [ ] Log back in; also try `dev-customer@girah.test`.
  Expected:
  Actual:
- [ ] **Password reset**: `/forgot-password` → customer email →
  **copy the reset link from the dev terminal** → set new password → log in
  with it; old password fails.
  Expected: generic "if that address has an account…" message (never reveals).
  Actual (paste the terminal line redacted):
- [ ] Wrong password → generic "Invalid email or password".
  Expected:
  Actual:
- [ ] Flood register (~10 rapid) → rate-limit error.
  Expected:
  Actual:

## 7. Checkout — COD full loop

- [ ] Empty cart → `/checkout` bounces to `/cart`.
  Expected:
  Actual:
- [ ] **Guest checkout** (incognito, filled cart): opens without login, no
  prefill, no save-address option.
  Expected:
  Actual:
- [ ] Signed in with saved address (§8): form **prefills**, save option shown.
  Expected:
  Actual:
- [ ] Missing/invalid fields → inline errors, no order created.
  Expected:
  Actual:
- [ ] Both radios visible (COD + Online Payment); **complete COD only**.
  Expected:
  Actual:
- [ ] Order summary lines show **thumbnails**.
  Expected: 48px thumbs next to each line.
  Actual:
- [ ] Place order → **confirmation**: `Order Confirmed`, `GIR-…` number,
  items, total, **5-step progress timeline** (Placed ✓ → Confirmed current).
  Expected:
  Actual:
- [ ] Dev terminal shows the order-received email.
  Expected: `[email] dev-log → to=<your email> subject="Order received — #…"`.
  Actual (paste terminal line):
- [ ] Header cart empty; account orders show the new order
  (`CONFIRMED` / payment `PENDING`).
  Expected:
  Actual:
- [ ] Total = subtotal + Rs. 0 shipping, 2 decimals everywhere.
  Expected:
  Actual:

## 8. Customer account area

- [ ] `/account` dashboard blocks: Orders, Profile, Saved Shipping, Wishlist.
  Expected:
  Actual:
- [ ] **Orders**: newest-first; open the new order — items, **status
  timeline**, total, payment label.
  Expected:
  Actual:
- [ ] **Cancel order**: offered while cancellable → two-step confirm →
  `CANCELLED` (stock returns). Shipped/delivered orders show no button.
  Expected:
  Actual:
- [ ] **Reorder** ("Buy again") → cart refills + inline confirmation.
  Expected:
  Actual:
- [ ] **Receipt**: opens; print button opens the print dialog.
  Expected:
  Actual:
- [ ] **Shipping address**: save → reload persists; checkout pre-fills it.
  Expected:
  Actual:
- [ ] **Profile**: edit name/phone → persists after reload.
  Expected:
  Actual:
- [ ] **Wishlist**: cards render; heart removes one; card → product page;
  empty → "Nothing saved yet"; signed-out visit bounces to login.
  Expected:
  Actual:
- [ ] **Review**: on an ordered (non-cancelled) product the form appears;
  submit → saved **PENDING**, invisible publicly (completed in §9).
  Expected:
  Actual:

## 9. Reviews loop (customer + admin)

- [ ] As customer submit review → guest view still shows nothing.
  Expected:
  Actual:
- [ ] As **admin**: `/admin/reviews` → pending item in queue (filter by status).
  Expected:
  Actual:
- [ ] **Approve** → public review + card stars appear.
  Expected:
  Actual:
- [ ] Submit another → **Reject** → never public.
  Expected:
  Actual:
- [ ] Non-buyer account sees "verified buyers only" instead of the form.
  Expected:
  Actual:

## 10. Admin back-office

Log in as `dev-admin@girah.test` / `DevAdmin123!` → `/admin`.

- [ ] **Authz first**: signed out → login bounce; customer → bounced home.
  Expected:
  Actual:
- [ ] Left nav wraps on mobile (no horizontal scroll); **Newsletter** item
  present.
  Expected:
  Actual:
- [ ] **Dashboard**: metric cards + 14-day revenue SVG reflect today's activity.
  Expected:
  Actual:
- [ ] **Products**: create (name, description, category, **real image upload**,
  rupees price, stock) → edit persists → toggle off hides from `/shop` →
  on reappears → delete unreferenced works; order-referenced delete refused
  with message.
  Expected (paste image URL):
  Actual:
- [ ] **Categories**: rename, create; deleting a used one is refused clearly.
  Expected:
  Actual:
- [ ] **Variations**: enable/disable, edit price/stock; disabled can't be bought.
  Expected:
  Actual:
- [ ] **Stock**: adjustment → history row with reason + timestamp + admin.
  Expected:
  Actual:
- [ ] **Orders**: filter/search; detail (customer, address, items, totals,
  payment); walk `CONFIRMED → PROCESSING → SHIPPED → DELIVERED` (status
  email per step in terminal); **Mark Paid** on COD `PENDING` → `PAID`;
  invalid jumps refused; **Refund** while `PAID` → two-step → `REFUNDED`;
  cancel a cancellable order → `CANCELLED`.
  Expected:
  Actual:
- [ ] **Customers**: roles + Disabled flags; toggle works; deactivated account
  can't log in.
  Expected:
  Actual:
- [ ] **Reviews**: §9 queue approve/reject.
  Expected:
  Actual:
- [ ] **Newsletter**: footer signup lands here (email + date); resubscribe →
  honest "already in the loop"; Remove → two-step → row gone, count updates.
  Expected:
  Actual:
- [ ] Every admin action gives inline feedback — no silent fails, no crashes.
  Expected:
  Actual:

## 11. Contact, SEO & security headers (light technical)

- [ ] `/about` + `/contact` render with `<title>… · Girah`.
  Expected:
  Actual:
- [ ] `/contact` shows the real email, prefilled order/idea mailtos,
  Islamabad line, 5 working images; `/shipping|/returns|/privacy|/terms`
  all 404.
  Expected:
  Actual:
- [ ] View-source home/product: `og:title`, landscape `og:image`
  (1536×1024), Twitter card; **noindex** on cart/checkout/search/confirmation.
  Expected:
  Actual:
- [ ] `/robots.txt` → private routes disallowed + `Sitemap:` pointer.
  Expected (paste the file):
  Actual:
- [ ] `/sitemap.xml` → home, shop, about, contact + live product URLs; **no**
  search/order/removed URLs.
  Expected (paste count):
  Actual:
- [ ] Document request headers: `Content-Security-Policy` (img pinned to
  Cloudinary), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Permissions-Policy`; `Cache-Control: private, no-store`
  on `/account`; no HSTS in dev (production-only, expected).
  Expected (paste CSP line):
  Actual:
- [ ] `/api/auth/csrf` sets exactly **one** `authjs.csrf-token` cookie.
  Expected:
  Actual:

## 12. Responsive & accessibility pass

- [ ] 360 / 768 / 1440px on home, shop, product, cart, checkout, account,
  admin — no overlap, no horizontal scroll.
  Expected:
  Actual:
- [ ] **Keyboard-only walk** home → shop → product → cart: visible sage focus
  everywhere, no traps; Enter/Space activate; Escape closes menu, drawer,
  filter sheet; Tab cycles inside dialogs; focus returns to triggers.
  Expected:
  Actual:
- [ ] One h1 per page, ordered headings; images have alt; inputs have labels
  (clicking a label focuses its field).
  Expected:
  Actual:
- [ ] OS "reduce motion" on → hero/gallery animations stop; back-to-top jumps.
  Expected:
  Actual:
- [ ] Money never `1234`, `Rs. NaN`, or `Rs. Infinity` anywhere.
  Expected:
  Actual:

## 13. Expected local caveats (not bugs)

| Observed | Why it's expected |
|----------|-------------------|
| Online (Safepay) order stays `PENDING` after paying in sandbox | Webhook can't reach `localhost` — needs a public tunnel in production |
| Emails only in the terminal | No `RESEND_API_KEY` locally — dev-log fallback by design |
| `/shipping|/returns|/privacy|/terms` are 404 | Removed by owner decision |
| Register says "too many attempts" | 10-per-15-minutes per IP throttle (skipped only in tests) |
| Safepay radio visible but online payment can't finish | Correct — only COD completes locally |

## 14. Optional: automated backup for everything above

```bash
npm run test:unit          # fast, no DB
npm run test:smoke         # 21 pages render clean (needs :3100 prod server)
E2E_BASE_URL=http://localhost:3100 npm run test:e2e   # ~350 checks
```

They create and clean up their own data. Anything these miss is by definition
in the manual sections above (visuals, responsiveness, print dialog, real
upload feel, motion).
