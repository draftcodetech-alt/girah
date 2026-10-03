# Girah — Manual GUI Test Guide

A complete click-through test of the storefront, customer account area, and
admin back-office. Everything is done in a browser against the **local dev
server**, plus a few light technical checks (view-source, DevTools Network,
the dev terminal for emails).

- Tick each box `- [ ]` as you verify it; jot down anything that deviates.
- "Expected" lines tell you what success looks like.
- Estimated full pass: **2–3 hours**.
- Sections 1–9 can be done as a guest/customer; §10+ needs the admin account.

---

## 0. Before you start

- [ ] Start the dev server (skip if already running):

  ```bash
  npm run dev          # → http://localhost:3000
  ```

- [ ] Keep the **terminal visible** while testing. There is no email provider
      configured locally, so every email prints there as
      `[email] dev-log → to=… subject=…` — including the **password-reset link**
      you'll need in §6.

- [ ] Sign-in accounts (seeded):

  | Role | Email | Password |
  |------|-------|----------|
  | Customer | `dev-customer@girah.test` | `DevCustomer123!` |
  | Admin | `dev-admin@girah.test` | `DevAdmin123!` |

  You'll also register a brand-new customer in §6 — use an address you control
  or something like `test-<timestamp>@example.com`.

- [ ] Read these **expected local behaviours** first so you don't report them
  as bugs (full list in §13):
  - Safepay's hosted checkout opens, but its **webhook can't reach localhost** —
    an online-paid order stays `PENDING` here. Cash-on-delivery (COD) is the
    complete local loop.
  - Legal pages (`/about`, `/returns`, …) intentionally show `[placeholder]`
    markers — no real policy copy yet.
  - Instagram/WhatsApp/social links are hidden (env vars unset, by design).
  - Registration is throttled: **10 attempts / 15 minutes per IP** — don't spam
    the register form; you'll get a "too many attempts" error.

---

## 1. Home & site shell

- [ ] Open http://localhost:3000 — page loads with **exactly one `<h1>`**.
- [ ] Hero: headline + "Shop Handmade" CTA → lands on `/shop`.
- [ ] Magazine grid, featured trio (01/02/03), trust strip, closing CTA all render.
- [ ] Scroll through the immersive bouquet section — it scrubs with scroll
      (with OS "reduce motion" enabled it should stay still).
- [ ] Header: wordmark, nav (Home / Shop / account), search field, cart icon
      with count badge; **Wishlist** appears only when signed in.
- [ ] Search in the header for `sunflower` → results page (§3).
- [ ] Footer has three columns — SHOP, ACCOUNT, **Information** — and every
      Information link (About, Contact, Shipping, Returns, Privacy, Terms)
      opens a real page (§11). **No dead links** (e.g. no `/faq`).
- [ ] `© {year} Girah` + trust line present.
- [ ] Mobile (or narrow window ~360px): hamburger opens a full-screen menu;
      **Escape** closes it, backdrop click closes it, page behind doesn't
      scroll while open; the menu has its own search box.
- [ ] Visit a nonsense URL (`/does-not-exist`) → branded 404 with a way back.

## 2. Shop, filters & pagination

- [ ] `/shop` renders the product grid; intro line reads
      "Discover handmade pieces, made with care."
- [ ] Product cards show image, name, **Rs. price with 2 decimals**, and the
      star-rating line ("No reviews yet" or a rating).
- [ ] Click a **category tab** → grid filters; the URL carries `?category=…`.
- [ ] Change **sort** order → order changes, URL updates.
- [ ] Set a **price range** and tick **in-stock only** → results narrow; the
      panel keeps your values after the page reloads.
- [ ] Combine filter + category: both stay applied together; a category tab
      link keeps the price filters.
- [ ] **Pagination**: 12 products per page, Prev/Next + numbered links,
      current page highlighted. Append `?page=999` to the URL → it clamps to
      the last real page (no endless empty screen).
- [ ] Change a filter or category **from page 2** → pagination resets to page 1
      (URL has no stale `page=`).
- [ ] Use an impossible filter combo → empty state with **Clear Search /
      Clear Filters** buttons that recover the full catalogue.
- [ ] Click the **heart** on a card → toggles (toast/aria state); sign in if
      prompted (§6) and confirm the heart persists after reload.

## 3. Search

- [ ] Header search for `E2E` (or any term you know exists) → `/search` with
      results and a count label like `N products matching "…"`.
- [ ] A term with matches across two pages shows pagination; the count label
      shows the **total**, not just page 1.
- [ ] Search `zzz-no-such-thing-zzz` → "No matches" empty state, no pagination.
- [ ] Clearing the field + searching again returns everything.
- [ ] (Light) View-source of the search page → `<meta name="robots" content="noindex…">`.

## 4. Product page

- [ ] Open any product from the shop — gallery images, name, 2-decimal price,
      description accordion **open** by default, details accordion closed.
- [ ] Toggle accordions (±, `aria-expanded` flips).
- [ ] If the product has **variations**: select each — button shows a pressed
      state and price/stock update; a disabled variation can't be added.
- [ ] Quantity stepper: can't go below 1 or above available stock (friendly
      error on attempt).
- [ ] **Add to cart** → success → **mini-cart drawer** slides in (right on
      desktop, bottom sheet on mobile) with correct line + total; Escape or
      backdrop closes it; "View Cart" → `/cart`.
- [ ] On mobile width, a sticky add-to-cart bar appears once the main button
      scrolls off-screen.
- [ ] Wishlist toggle on the product page works and matches the card heart.
- [ ] (Light) View-source → JSON-LD `@type: "Product"` with a price and
      `priceCurrency`.
- [ ] Breadcrumb (or logo) navigates back cleanly.

## 5. Cart

- [ ] `/cart` lists lines with images, variations, steppers, line totals,
      and a **2-decimal** Total; shipping shows as FREE.
- [ ] Raise quantity above stock → inline refusal, quantity unchanged.
- [ ] Remove a line → disappears; removing the last line → empty-cart state
      with a link back to the shop.
- [ ] **Guest merge test**: open an **incognito window**, add 1–2 items as a
      guest, then log in (§6 credentials) → the guest items are still in the
      cart (they merged into the account cart).
- [ ] Header cart badge matches the cart contents.
- [ ] **Checkout** button → `/checkout` (works signed-out too — see the guest
      flow in §7); an empty cart redirects to `/cart`.

## 6. Auth: register, login, password reset

- [ ] Signed out, visit `/account` → redirected to
      `/login?callbackUrl=…`; after login you return to `/account`.
- [ ] `/register`: submit an empty form → field-level validation errors.
- [ ] Register with a **mismatched password/confirm** → error, no account.
- [ ] Register a fresh account (name, unique email, ≥8-char password) →
      signed in automatically, header now shows Wishlist/account.
- [ ] Register the **same email again** → "already registered"-style error.
- [ ] Log out, then log back in with the new account; also log in as
      `dev-customer@girah.test`.
- [ ] On the login/register pages, **Continue as Guest** returns you to
      shopping without an account.
- [ ] **Password reset**: `/forgot-password` → enter the customer email →
      **copy the reset link from the dev terminal** → open it → set a new
      password → log in with the **new** password. (Repeated requests for the
      same email are throttled too — "Too many reset requests".)
- [ ] The **old** password no longer works after the reset.
- [ ] Wrong password at login → generic "Invalid email or password" (never
      reveals whether the email exists).
- [ ] Registration flood test: after ~10 rapid attempts expect a rate-limit
      error (then wait 15 min or switch IPs — see §13).

## 7. Checkout — COD full loop

- [ ] With an **empty cart**, visiting `/checkout` bounces you to `/cart`
      (add an item first).
- [ ] **Guest checkout**: from an incognito window with a filled cart,
      `/checkout` opens without login — no prefill and no "save address"
      option (those are for signed-in users). Place a COD order here too if
      you like; it completes like §7's main flow.
- [ ] Signed in with a saved address (§8): the form **prefills** it and the
      save-address option is offered.
- [ ] Submit checkout with missing/invalid fields (bad phone/postal) →
      inline errors, no order created.
- [ ] Payment options: **Cash on delivery** (select it) and **Online Payment
      (Cards, JazzCash, EasyPaisa)** — both radios visible (Safepay is
      configured). **Only complete COD locally** (see §13 for Safepay).
- [ ] Place the order → **confirmation page** with an order number
      (`GIR-…`), items, and totals.
- [ ] Dev terminal shows the confirmation email (`[email] dev-log → …`).
- [ ] Header cart is now empty; the account's order list shows the new order
      as `PENDING` / payment `PENDING`.
- [ ] Money math: Total = subtotal + Rs. 0 shipping, formatted with 2 decimals
      everywhere.

## 8. Customer account area

- [ ] `/account` dashboard shows the four blocks: Orders, Profile, Saved
      Shipping, **Wishlist**.
- [ ] **Orders**: list renders newest-first; open your new order — items,
      status timeline, total.
- [ ] **Cancel order**: offered only while payment is `PENDING` **and** status
      is `PENDING`/`CONFIRMED` — cancel your fresh order → status becomes
      `CANCELLED` (stock returns). An already-shipped/delivered order shows
      no cancel button.
- [ ] **Reorder** on a past order → the cart fills with those lines.
- [ ] **Receipt**: open it; the print button opens the print dialog.
- [ ] **Shipping address**: save an address (all fields) → reload → it's
      persisted; checkout pre-fills it (§7).
- [ ] **Profile**: edit name/phone → save → values persist after reload.
- [ ] **Wishlist**: open from the header → wishlisted products show as cards;
      tapping the heart again removes one; opening a card → its product page;
      emptying it shows "Nothing saved yet" + "Browse the shop"; signed-out
      visit to `/wishlist` bounces to login.
- [ ] **Review**: on a product you've ordered (even `PENDING` — any
      non-cancelled order qualifies), the review form appears; submit a rating
      + text → saved as **PENDING** (not yet visible on the product page).
      (Full loop completed in §9.)

## 9. Reviews loop (customer + admin)

- [ ] As the customer: submit the review (§8 last step); reload the product
      page as a guest → the review is **not** visible yet.
- [ ] As **admin** (§10 login): `/admin/reviews` → the pending review is in
      the moderation queue.
- [ ] **Approve** it → reload the product page → the review and the card
      star-rating now show publicly.
- [ ] Submit another review, then **Reject** it → it never appears publicly.
- [ ] A non-buyer account: product page shows the "verified buyers only"
      message instead of the form.

## 10. Admin back-office

Log in as `dev-admin@girah.test` / `DevAdmin123!` and open `/admin`.

- [ ] **Authz spot-checks first**: signed out → `/admin` bounces to login;
      logged in as the customer → bounced (not an admin).
- [ ] **Dashboard**: metric cards (revenue/orders/customers etc.) and the
      14-day revenue SVG chart render with today's activity reflected.
- [ ] **Products**:
  - Create a product: name, description, category, **real image upload**
    (Cloudinary — confirm the image appears), price in rupees, stock.
  - Edit it (price/stock change persists; image management works).
  - Toggle availability off → it disappears from `/shop`; back on → reappears.
  - Delete an unreferenced product → gone; a product with order history is
    protected (refusal message, product intact).
- [ ] **Categories**: rename existing, create new; deleting a category that
      still has products is **refused** with a clear error.
- [ ] **Variations**: enable/disable a variation, edit its price/stock; a
      disabled variation can't be bought (product page blocks it).
- [ ] **Stock**: record an adjustment → the **Stock history** table shows the
      change with reason and timestamp; product stock updates.
- [ ] **Orders**:
  - Filter/search the list; open an order detail (customer, address, items,
    subtotal/shipping/total, payment state).
  - Walk the status select: `PENDING → CONFIRMED → PROCESSING → SHIPPED →
    DELIVERED` — each change persists and a status email hits the terminal.
  - **Mark Paid** appears for COD orders with payment `PENDING` → payment
    becomes `PAID` (an invalid transition is refused inline).
  - **Refund** (detail page, while `PAID`) → two-step confirm
    ("Yes, refund Rs X" / "Keep payment") → payment `REFUNDED`.
  - Cancel a still-cancellable order → `CANCELLED`.
- [ ] **Customers**: list shows roles and "(Disabled)" flags; open a detail →
      the activate/deactivate toggle works (a deactivated account can't log
      in).
- [ ] **Reviews**: approve/reject from §9; queue filters by status.
- [ ] Every admin action gives **inline success or error feedback** — no
      silent failures, no full-page crashes.

## 11. SEO, content pages & security headers (light technical)

- [ ] Each content page opens with the right `<title>` (ends in `· Girah`):
      `/about`, `/contact`, `/shipping`, `/returns`, `/privacy`, `/terms`.
- [ ] Legal pages contain visible `[placeholder]` markers (expected) and
      `/terms` links to `/returns` (works).
- [ ] `/contact` lists only configured channels (or placeholder note when
      none are set).
- [ ] View-source of `/shop`, `/cart`, `/checkout`, `/search`:
      `og:title`, `og:image`, Twitter card present on the home/product pages;
      **noindex** on cart/checkout/search; indexable on home/shop/product.
- [ ] `http://localhost:3000/robots.txt` → `Allow: /`, private routes
      (`/admin`, `/account`, `/checkout`, …) disallowed, `Sitemap:` present.
- [ ] `http://localhost:3000/sitemap.xml` → home, shop, the six content pages
      and live product URLs; **no** `/search` or order URLs.
- [ ] DevTools → Network → any document request → response headers include
      `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
      (`Strict-Transport-Security` is **production-only** — absent here is
      expected, see §13.)
- [ ] `/api/auth/csrf` sets exactly **one** `authjs.csrf-token` cookie
      (Network tab).

## 12. Responsive & accessibility pass

- [ ] Check key pages at ~360px, ~768px, and ~1440px wide: home, shop, product,
      cart, checkout, account, admin dashboard — no overlap or horizontal
      scrolling (admin tables may scroll deliberately).
- [ ] **Keyboard-only walk**: Tab through home → shop → product → cart;
      focus is always visible (sage outline), no keyboard traps; Enter/Space
      activate buttons; Escape closes the mobile menu and mini-cart drawer.
- [ ] Headings make sense (one h1 per page, ordered headings below it).
- [ ] Images have meaningful alt text; form inputs have labels.
- [ ] OS "reduce motion" on → immersive scroll/marquee animations stop.
- [ ] Money is never shown as `1234` or `Rs. NaN` anywhere.

## 13. Expected local caveats (not bugs)

| Observed | Why it's expected |
|----------|-------------------|
| Online (Safepay) order stays `PENDING` after paying in sandbox | Safepay's webhook can't reach `localhost` — needs a public tunnel in production |
| Emails only in the terminal | No `RESEND_API_KEY` locally — the dev-log fallback is by design |
| `[placeholder]` text on legal/contact pages | Real copy not written yet — deliberate, nothing fake ships |
| No Instagram/WhatsApp/social links | Their env vars are unset — sections are gated, not broken |
| No `Strict-Transport-Security` header in dev | HSTS is enabled only for production builds |
| Register says "too many attempts" | 10-per-15-minutes per IP throttle (skipped only in tests) |
| Safepay radio visible but you can't finish an online payment | Correct — only COD completes locally |

## 14. Optional: automated backup for everything above

The HTTP suites cover most of §1–§11 without a browser:

```bash
npm run test:smoke                            # 21 pages render clean
E2E_BASE_URL=http://localhost:3000 npm run test:e2e   # 310 checks
```

They create and clean up their own data. Anything these miss is by definition
in the manual sections above (visuals, responsiveness, print dialog, real
Cloudinary upload feel).
