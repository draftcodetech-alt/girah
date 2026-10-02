// Girah E2E suite — drives the production server (default :3100, no browser).
// Server actions are plain HTTP: POST the page that owns the reference with
// `Next-Action: <id>` and a JSON-array body; ids are re-extracted every run
// from .next/server/app/**/server-reference-manifest.json.
//
// Self-contained: creates its own users/products/order fixtures and removes
// them at the end, so it runs against any database (dev, girah_test, CI).
// Usage: `npm run build && npm start &` then `npm run test:e2e`.
//   E2E_BASE_URL  — override the server origin (default http://localhost:3100)
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Resolve the app's dependencies and files from the repo root (this file lives
// in scripts/, so `..` is the project).
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(join(ROOT, "package.json"));
require("dotenv").config({ path: join(ROOT, ".env") });
const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const TS = Date.now();

// ── stale-fixture sweep ─────────────────────────────────────────────────────
// A run that dies before reaching its cleanup block leaves fixtures behind.
// They accumulate and eventually push this run's fresh fixtures past the
// shop's 12-per-page window (default sort is createdAt asc), breaking
// catalogue assertions. Runs at startup, before this run creates anything.
async function sweepStaleFixtures() {
  const stale = await db.product.findMany({
    where: { slug: { startsWith: "e2e-" } },
    select: { id: true, variations: { select: { id: true } } },
  });
  if (stale.length) {
    const productIds = stale.map((p) => p.id);
    const variationIds = stale.flatMap((p) => p.variations.map((v) => v.id));
    // CartItem/OrderItem hold Restrict FKs to variations — clear them first.
    await db.cartItem.deleteMany({ where: { variationId: { in: variationIds } } });
    const staleOrders = await db.order.findMany({
      where: { items: { some: { variationId: { in: variationIds } } } },
      select: { id: true },
    });
    for (const order of staleOrders) {
      await db.order.delete({ where: { id: order.id } }).catch(() => {});
    }
    // Variations/images/reviews/wishlists cascade from the product delete.
    await db.product.deleteMany({ where: { id: { in: productIds } } }).catch(() => {});
  }
  // Orphaned register-test users from aborted runs (their carts cascade away).
  const staleUsers = await db.user.findMany({
    where: { email: { startsWith: "e2e-user-", endsWith: "@example.com" } },
    select: { id: true },
  });
  for (const user of staleUsers) {
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}
await sweepStaleFixtures();

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `  << ${detail}` : ""}`);
}

// ── HTTP helpers ────────────────────────────────────────────────────────────
async function safeFetch(url, init = {}, tries = 4) {
  let lastError;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      const transient = /UND_ERR_SOCKET|ECONNRESET|fetch failed/i.test(String(error?.cause ?? error));
      if (!transient || attempt === tries - 1) throw error;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

const newJar = () => new Map();
const jarHeader = (jar) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function applySetCookies(jar, setCookies) {
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired =
      value === "" || /max-age=0/i.test(sc) || /expires=thu,\s*01 jan 1970/i.test(sc);
    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
}

async function get(path, jar = null) {
  const res = await safeFetch(BASE + path, {
    redirect: "manual",
    headers: jar && jar.size ? { Cookie: jarHeader(jar) } : {},
  });
  return { status: res.status, location: res.headers.get("location"), html: await res.text(), res };
}

// The action payload is flight-encoded (`0:{...envelope}` then `1:{result}`).
// Walk lines backwards and take the first real object that isn't the envelope.
function parseActionPayload(text) {
  for (const line of text.split("\n").reverse()) {
    const m = line.match(/^\d+:(.*)$/s);
    if (!m) continue;
    try {
      const value = JSON.parse(m[1]);
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      if ("b" in value && "i" in value && "a" in value) continue; // row envelope
      return value;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

async function callAction(path, actionId, args, jar = null) {
  const res = await safeFetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": actionId,
      Accept: "text/x-component",
      Origin: BASE,
      ...(jar && jar.size ? { Cookie: jarHeader(jar) } : {}),
    },
    body: JSON.stringify(args),
  });
  const setCookies = res.headers.getSetCookie();
  const text = await res.text();
  if (jar) applySetCookies(jar, setCookies);
  return {
    status: res.status,
    location: res.headers.get("location"),
    // Fetch actions (Next-Action + Accept: text/x-component) communicate a
    // redirect() inside the action via this header on a 200 — not a 3xx.
    actionRedirect: res.headers.get("x-action-redirect"),
    setCookies,
    json: parseActionPayload(text),
    text,
  };
}

// Actions whose single argument IS a FormData (file uploads) go over multipart
// with React's flight encoding: field "0" holds the args JSON pointing at the
// FormData via "$K<partId>", and fields "_1_<name>" carry its entries. Order
// matters — the streaming decoder parses field "0" on arrival, so every "_1_"
// part must be appended BEFORE the root (React's own encoder sets root last).
async function callActionFormData(path, actionId, formData, jar = null) {
  const body = new FormData();
  for (const [key, value] of formData.entries()) body.append(`_1_${key}`, value);
  body.append("0", JSON.stringify(["$K1"]));
  const res = await safeFetch(BASE + path, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Next-Action": actionId,
      Accept: "text/x-component",
      Origin: BASE,
      ...(jar && jar.size ? { Cookie: jarHeader(jar) } : {}),
    },
    body,
  });
  const setCookies = res.headers.getSetCookie();
  const text = await res.text();
  if (jar) applySetCookies(jar, setCookies);
  return { status: res.status, json: parseActionPayload(text), text };
}

// Classic Auth.js credentials login (route handler path — used for admin setup).
async function apiLogin(email, password) {
  const jar = newJar();
  const csrfRes = await safeFetch(BASE + "/api/auth/csrf", { headers: { Cookie: jarHeader(jar) } });
  applySetCookies(jar, csrfRes.headers.getSetCookie());
  const { csrfToken } = await csrfRes.json();
  const res = await safeFetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
      Cookie: jarHeader(jar),
    },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: "/", redirect: "false" }).toString(),
  });
  applySetCookies(jar, res.headers.getSetCookie());
  return { status: res.status, location: res.headers.get("location"), jar };
}

function actionIds() {
  const ids = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "server-reference-manifest.json") {
        const manifest = JSON.parse(readFileSync(full, "utf8"));
        const node = manifest.node ?? manifest;
        for (const [id, meta] of Object.entries(node)) {
          if (meta && typeof meta === "object" && meta.exportedName) ids[meta.exportedName] = id;
        }
      }
    }
  };
  walk(join(ROOT, ".next/server/app"));
  return ids;
}

// ── HTML assertions ─────────────────────────────────────────────────────────
function moneyWithoutTwoDecimals(html) {
  const found = html.match(/Rs\.\s?\d[\d,]*(?:\.\d+)?/g) ?? [];
  return found.filter((m) => !/\.\d{2}$/.test(m));
}

function countMoney(html) {
  return (html.match(/Rs\.\s?\d[\d,]*(?:\.\d+)?/g) ?? []).length;
}

// The cart line block runs from the product name to its Remove button.
function lineBlock(html, productName) {
  const start = html.indexOf(productName);
  if (start < 0) return "";
  const end = html.indexOf(`aria-label="Remove ${productName}"`, start);
  return html.slice(start, end < 0 ? start + 3000 : end);
}

// Stepper buttons carry a `disabled:` Tailwind *class*, so match the attribute.
function stepperDisabled(block) {
  const tag = block.match(/<button[^>]*aria-label="Increase quantity"[^>]*>/)?.[0];
  return Boolean(tag) && /\sdisabled(\s|=|>)/.test(tag);
}

// The author's own form carries their draft/previous text in two places that
// are NOT a rendered review: the textarea's defaultValue and the RSC flight
// payload (client-component props inside inline <script>s). Strip both so a
// "hidden while pending" check only inspects actually-rendered output.
function visibleHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<textarea[\s\S]*?<\/textarea>/g, "");
}

// ── fixtures ────────────────────────────────────────────────────────────────
// Nothing below depends on `prisma db seed` or on a particular developer
// database having data — users, products and the probe order are created here.
const CUSTOMER = { email: "dev-customer@girah.test", password: "DevCustomer123!" };
const ADMIN = { email: "dev-admin@girah.test", password: "DevAdmin123!" };

async function ensureUser({ email, password, role }) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;
  return db.user.create({
    data: {
      email,
      name: email.split("@")[0],
      role,
      passwordHash: await bcrypt.hash(password, 10),
      isActive: true,
    },
  });
}

async function wipeUserCart(userId) {
  await db.cart.deleteMany({ where: { userId } });
}

async function seedGuestCart(guestId, variationId, quantity) {
  const cart = await db.cart.upsert({ where: { guestId }, update: {}, create: { guestId } });
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  await db.cartItem.create({ data: { cartId: cart.id, variationId, quantity } });
  return cart;
}

async function seedUserCart(userId, lines) {
  await wipeUserCart(userId);
  const cart = await db.cart.create({ data: { userId } });
  for (const line of lines) {
    await db.cartItem.create({ data: { cartId: cart.id, variationId: line.variationId, quantity: line.quantity } });
  }
  return cart;
}

const CHECKOUT = {
  fullName: "E2E Buyer",
  phone: "03001234567",
  email: "e2e-buyer@example.com",
  address: "1 Test Street",
  city: "Karachi",
  postalCode: "74000",
  deliveryNotes: "",
  paymentMethod: "COD",
};

// ── run ─────────────────────────────────────────────────────────────────────
const ids = actionIds();
const requiredActions = [
  "login",
  "register",
  "addToCart",
  "updateCartItemQuantity",
  "removeCartItem",
  "placeOrder",
  // Phase 14/15 actions — fail fast if the manifest stops exposing them.
  "requestPasswordReset",
  "resetPassword",
  "toggleWishlist",
  // Section 22 actions — the wrappers behind Pay Now and the stock audit.
  "adjustStock",
  "startSafepayRetry",
];
for (const name of requiredActions) {
  check(`action id resolved: ${name}`, Boolean(ids[name]), `missing from server-reference-manifest.json`);
}
if (results.some((r) => !r.ok)) {
  console.log("\nCannot continue without action ids.");
  process.exit(1);
}

const customer = await ensureUser({ ...CUSTOMER, role: "CUSTOMER" });
await ensureUser({ ...ADMIN, role: "ADMIN" });

// Reuse any category that exists; create one on a fresh (unseeded) database.
const category =
  (await db.category.findFirst()) ??
  (await db.category.create({ data: { name: "E2E Fixtures", slug: "e2e-fixtures" } }));

// Cart/checkout fixture — variation NAMES match the seed's so the assertions
// read the same, but the records are ours (stock is restored, product deleted).
const fixtureProduct = await db.product.create({
  data: {
    name: `E2E Fixture Bouquet ${TS}`,
    slug: `e2e-fixture-${TS}`,
    description: "E2E cart/checkout fixture.",
    categoryId: category.id,
    variations: {
      create: [
        { name: "Small Bouquet", price: 180000, stock: 10, isEnabled: true },
        { name: "Single Sunflower", price: 80000, stock: 17, isEnabled: true },
        { name: "Full Floral Bouquet", price: 500000, stock: 10, isEnabled: false },
      ],
    },
  },
  include: { variations: true },
});
const variationIdOf = (name) => fixtureProduct.variations.find((v) => v.name === name).id;
const V_SMALL = variationIdOf("Small Bouquet"); // enabled, stock 10
const V_SINGLE = variationIdOf("Single Sunflower"); // enabled, stock 17 (stock-0 test)
const V_DISABLED = variationIdOf("Full Floral Bouquet"); // isEnabled=false
const FIXTURE_NAME = fixtureProduct.name;

// Probe order for the admin state-machine check — created, never assumed.
const probeOrder = await db.order.create({
  data: {
    orderNumber: `GIR-${TS.toString(16).padStart(12, "0").slice(-12)}`,
    customerName: "E2E Probe",
    customerEmail: "e2e-probe@example.com",
    customerPhone: "03001234567",
    shippingAddress: "1 Test Street",
    shippingCity: "Karachi",
    subtotal: 100000,
    total: 100000,
    orderStatus: "CONFIRMED",
    paymentMethod: "COD",
    paymentStatus: "PENDING",
  },
});

// Float-rounding fixtures: 8.3 * 100 === 830.0000000000001 in JS, so without
// toPaisa() a `minPrice=8.3` filter silently drops a Rs. 8.30 product.
const floatProducts = {};
for (const [key, price] of [["exact", 830], ["under", 829]]) {
  const slug = `e2e-float-${key}-${TS}`;
  const product = await db.product.create({
    data: {
      name: `E2E Float ${key} ${TS}`,
      slug,
      description: "Phase 5 float-price filter fixture.",
      categoryId: category.id,
      variations: { create: [{ name: "Standard", price, stock: 5, isEnabled: true }] },
    },
    include: { variations: true },
  });
  floatProducts[key] = product;
}
// A product with no purchasable variation must render "Unavailable", never "From Rs. 0".
const unavailableProduct = await db.product.create({
  data: {
    name: `E2E Unavailable ${TS}`,
    slug: `e2e-unavailable-${TS}`,
    description: "Phase 5 zero-price guard fixture.",
    categoryId: category.id,
    variations: { create: [{ name: "Hidden", price: 0, stock: 0, isEnabled: false }] },
  },
});

// ── 1. page regressions ─────────────────────────────────────────────────────
for (const path of ["/", "/shop", "/cart", "/login", "/register", `/product/${fixtureProduct.slug}`]) {
  const res = await get(path);
  check(`GET ${path} → 200`, res.status === 200, `got ${res.status}`);
}
const anonAccount = await get("/account");
check("anon GET /account → /login", anonAccount.status >= 300 && anonAccount.status < 400 && (anonAccount.location ?? "").includes("/login"), `${anonAccount.status} ${anonAccount.location}`);
const anonAdmin = await get("/admin");
check("anon GET /admin → login with callbackUrl", anonAdmin.status >= 300 && anonAdmin.status < 400 && (anonAdmin.location ?? "").includes("/login?callbackUrl=%2Fadmin"), `${anonAdmin.status} ${anonAdmin.location}`);

// ── 2. two-decimal money everywhere ─────────────────────────────────────────
const shop = await get("/shop");
check("shop renders 2-decimal prices", countMoney(shop.html) >= 3 && moneyWithoutTwoDecimals(shop.html).length === 0, JSON.stringify(moneyWithoutTwoDecimals(shop.html)));
const productPage = await get(`/product/${fixtureProduct.slug}`);
check("product page renders 2-decimal prices", countMoney(productPage.html) >= 1 && moneyWithoutTwoDecimals(productPage.html).length === 0, JSON.stringify(moneyWithoutTwoDecimals(productPage.html)));

// ── 3. catalog filters ──────────────────────────────────────────────────────
const floatFilter = await get(`/shop?minPrice=8.3`);
check("minPrice=8.3 keeps the Rs. 8.30 product", floatFilter.html.includes(floatProducts.exact.name), "float paisa dropped an exact match");
check("minPrice=8.3 excludes the Rs. 8.29 product", !floatFilter.html.includes(floatProducts.under.name), "cheaper product leaked through");
// Non-finite/negative bounds must be dropped by sanitizeFilters.toPaisa —
// previously Number("Infinity")*100 reached Prisma as Infinity and broke the page.
const weird = await get("/shop?minPrice=Infinity&maxPrice=NaN");
check("garbage price params → 200 with prices intact", weird.status === 200 && !weird.html.includes("Rs. NaN") && !weird.html.includes("Rs. undefined"), `${weird.status}`);
check("non-finite bounds are ignored, not applied", weird.html.includes(floatProducts.exact.name), "the whole catalogue was filtered away");
const preserved = await get("/shop?minPrice=8.3&maxPrice=20.75&inStockOnly=true&search=bouquet");
check("price filters survive a search round trip", preserved.html.includes('name="minPrice" value="8.3"') && preserved.html.includes('name="maxPrice" value="20.75"'), "hidden inputs missing");
check("filter panel re-fills from the query", preserved.html.includes('value="8.3"') && preserved.html.includes('value="20.75"'));
const tabs = await get("/shop?minPrice=8.3&maxPrice=20.75");
check("category tab hrefs carry minPrice/maxPrice", /href="\/shop\?[^"]*minPrice=8\.3[^"]*maxPrice=20\.75[^"]*"/.test(tabs.html) || /href="\/shop\?[^"]*maxPrice=20\.75[^"]*minPrice=8\.3[^"]*"/.test(tabs.html), "tab link dropped the filters");

// ── 4. login merges the guest cart (the Phase 5 blocker) ────────────────────
await wipeUserCart(customer.id);
const guestId = `e2e-guest-login-${TS}`;
await seedGuestCart(guestId, V_SINGLE, 2);

const loginJar = newJar();
loginJar.set("girah_guest_id", guestId);
const loginRes = await callAction("/login", ids.login, [{ email: CUSTOMER.email, password: CUSTOMER.password }], loginJar);
check("login action → success", loginRes.json?.success === true, JSON.stringify(loginRes.json));
check("login establishes a session cookie", loginJar.has("authjs.session-token"), [...loginJar.keys()].join(","));
check("login clears girah_guest_id", !loginJar.has("girah_guest_id"), [...loginJar.keys()].join(","));
check("guest cart row is gone", (await db.cart.findFirst({ where: { guestId } })) === null);
const mergedCart = await db.cart.findUnique({ where: { userId: customer.id }, include: { items: true } });
const mergedLine = mergedCart?.items.find((i) => i.variationId === V_SINGLE);
check("merged line lands in the account cart (qty 2)", mergedLine?.quantity === 2, JSON.stringify(mergedCart?.items ?? null));
const cartHtml = await get("/cart", loginJar);
check("signed-in /cart renders the merged line", cartHtml.status === 200 && cartHtml.html.includes("Single Sunflower"), `${cartHtml.status}`);
check("/cart money is 2-decimal", countMoney(cartHtml.html) >= 1 && moneyWithoutTwoDecimals(cartHtml.html).length === 0, JSON.stringify(moneyWithoutTwoDecimals(cartHtml.html)));

// ── 5. register merges the guest cart ───────────────────────────────────────
const registerJar = newJar();
const guestIdReg = `e2e-guest-register-${TS}`;
await seedGuestCart(guestIdReg, V_SMALL, 1);
registerJar.set("girah_guest_id", guestIdReg);
const registerEmail = `e2e-user-${TS}@example.com`;
const registerRes = await callAction(
  "/register",
  ids.register,
  [{ name: "E2E User", email: registerEmail, password: "password123", confirmPassword: "password123" }],
  registerJar
);
check("register action → success", registerRes.json?.success === true, JSON.stringify(registerRes.json));
check("register clears girah_guest_id", !registerJar.has("girah_guest_id"), [...registerJar.keys()].join(","));
check("register guest cart row is gone", (await db.cart.findFirst({ where: { guestId: guestIdReg } })) === null);
const newUser = await db.user.findUnique({ where: { email: registerEmail } });
const newUserCart = newUser ? await db.cart.findUnique({ where: { userId: newUser.id }, include: { items: true } }) : null;
check("merged line lands in the new account cart", newUserCart?.items.some((i) => i.variationId === V_SMALL && i.quantity === 1) === true, JSON.stringify(newUserCart?.items ?? null));

// Phase 4 L1 still holds after the Phase 5 rewrite of register().
const dupJar = newJar();
const dupRegister = await callAction(
  "/register",
  ids.register,
  [{ name: "Dup", email: CUSTOMER.email.toUpperCase(), password: "password123", confirmPassword: "password123" }],
  dupJar
);
check(
  "case-variant duplicate register → friendly field error",
  dupRegister.json?.success === false && /already associated/i.test(dupRegister.json?.fieldErrors?.email ?? ""),
  JSON.stringify(dupRegister.json)
);

// ── 6. disabled line: badge + disabled steppers ─────────────────────────────
await seedUserCart(customer.id, [{ variationId: V_DISABLED, quantity: 1 }]);
const disabledPage = await get("/cart", loginJar);
const disabledBlock = lineBlock(disabledPage.html, FIXTURE_NAME);
check("disabled variation shows the Unavailable badge", disabledBlock.includes("Unavailable"), disabledBlock.slice(0, 300));
check("disabled variation disables its steppers", stepperDisabled(disabledBlock), "steppers still interactive");

// ── 7. checkout names the unavailable line ──────────────────────────────────
const orderRes = await callAction("/checkout", ids.placeOrder, [CHECKOUT], loginJar);
check("checkout refuses an unavailable line", orderRes.json?.success === false, JSON.stringify(orderRes.json));
check(
  "checkout error names the exact line",
  typeof orderRes.json?.error === "string" &&
    orderRes.json.error.includes(`"${FIXTURE_NAME} — Full Floral Bouquet" is no longer available`),
  String(orderRes.json?.error)
);

// ── 8. quantity guards ──────────────────────────────────────────────────────
const disabledCart = await db.cart.findUnique({ where: { userId: customer.id }, include: { items: true } });
const disabledItem = disabledCart?.items[0];
check("cart seeded for quantity guards", Boolean(disabledItem));
const negative = await callAction("/cart", ids.updateCartItemQuantity, [disabledItem.id, -1], loginJar);
check("negative quantity refused", negative.json?.success === false && negative.json?.error === "Invalid quantity.", JSON.stringify(negative.json));
const addZero = await callAction("/cart", ids.addToCart, [V_SINGLE, 0], loginJar);
check("addToCart(0) refused", addZero.json?.success === false && addZero.json?.error === "Invalid quantity.", JSON.stringify(addZero.json));
const addDisabled = await callAction("/cart", ids.addToCart, [V_DISABLED, 1], loginJar);
check("addToCart of a disabled variation refused", addDisabled.json?.success === false && addDisabled.json?.error === "This item is no longer available.", JSON.stringify(addDisabled.json));

// ── 9. stock-0: steppers disabled + friendly error, never a silent delete ───
await seedUserCart(customer.id, [{ variationId: V_SINGLE, quantity: 1 }]);
const singleBefore = await db.productVariation.findUniqueOrThrow({ where: { id: V_SINGLE } });
const item = await db.cartItem.findFirst({ where: { cart: { userId: customer.id } } });
const inStockPage = await get("/cart", loginJar);
const inStockBlock = lineBlock(inStockPage.html, FIXTURE_NAME);
check("in-stock line keeps working steppers", !stepperDisabled(inStockBlock), inStockBlock.slice(0, 300));

await db.productVariation.update({ where: { id: V_SINGLE }, data: { stock: 0 } });
try {
  const outOfStockPage = await get("/cart", loginJar);
  const outBlock = lineBlock(outOfStockPage.html, FIXTURE_NAME);
  check("stock-0 line disables its steppers", stepperDisabled(outBlock), outBlock.slice(0, 300));
  const bump = await callAction("/cart", ids.updateCartItemQuantity, [item.id, 1], loginJar);
  check(
    "stock-0 change → friendly error (line kept)",
    bump.json?.success === false &&
      bump.json?.error === "This item is out of stock — remove it from your cart or try again later.",
    JSON.stringify(bump.json)
  );
  const kept = await db.cartItem.findUnique({ where: { id: item.id } });
  check("stock-0 refusal never deletes the line", Boolean(kept));

  // qty-0 is the Remove path (steppers can't reach 0; the Remove button does).
  const remove = await callAction("/cart", ids.updateCartItemQuantity, [item.id, 0], loginJar);
  check("quantity 0 removes the line", remove.json?.success === true, JSON.stringify(remove.json));
  check("removed line is gone from the DB", (await db.cartItem.findUnique({ where: { id: item.id } })) === null);
} finally {
  await db.productVariation.update({ where: { id: V_SINGLE }, data: { stock: singleBefore.stock } });
}

// ── 10. zero-price product card ─────────────────────────────────────────────
const shopAgain = await get("/shop");
check("zero-price product renders Unavailable, not From Rs. 0", shopAgain.html.includes(unavailableProduct.name) && lineBlock(shopAgain.html, unavailableProduct.name).includes("Unavailable"), "card missing or priced");
check("no 'From Rs. 0' anywhere on /shop", !shopAgain.html.includes("From Rs. 0"));

// ── 11. auth regression (Phase 4 paths still alive) ─────────────────────────
const wrongPassword = await callAction("/login", ids.login, [{ email: "e2e-nobody@example.com", password: "definitely-wrong" }]);
check("wrong password → generic error", wrongPassword.json?.success === false && wrongPassword.json?.error === "Invalid email or password.", JSON.stringify(wrongPassword.json));
const adminLogin = await apiLogin(ADMIN.email, ADMIN.password);
const adminRedirected = (adminLogin.location ?? "").includes("error");
check("admin credentials login succeeds", adminLogin.status >= 300 && adminLogin.status < 400 && !adminRedirected && adminLogin.jar.has("authjs.session-token"), `${adminLogin.status} ${adminLogin.location}`);
const adminPage = await get("/admin", adminLogin.jar);
check("signed-in admin sees /admin", adminPage.status === 200, `${adminPage.status} ${adminPage.location}`);

// ── 12. Phase 6: refused admin actions must answer with success:false ───────
check("updateOrderStatus action id resolved", Boolean(ids.updateOrderStatus), "missing from server-reference-manifest.json");
{
  const target = await db.order.findUnique({ where: { id: probeOrder.id } });
  check("a CONFIRMED order exists to probe", target?.orderStatus === "CONFIRMED", `${target?.orderStatus}`);
  if (target) {
    const refused = await callAction(
      "/admin/orders",
      ids.updateOrderStatus,
      [target.id, { orderStatus: "PENDING" }],
      adminLogin.jar
    );
    check(
      "illegal CONFIRMED → PENDING is refused over the wire",
      refused.json?.success === false && /^Cannot move an order from/.test(refused.json?.error ?? ""),
      JSON.stringify(refused.json)
    );
    const after = await db.order.findUnique({ where: { id: target.id } });
    check("refused transition leaves the order untouched", after?.orderStatus === "CONFIRMED", `${after?.orderStatus}`);
  }
}

// ── 13. Phase 7: proxy callbackUrl, Header scoping, 404 handling ────────────
{
  const anonAdmin = await get("/admin/products");
  check(
    "anon /admin/products bounces to login with callbackUrl",
    [302, 307].includes(anonAdmin.status) &&
      (anonAdmin.location ?? "").includes("/login?callbackUrl=%2Fadmin%2Fproducts"),
    `${anonAdmin.status} ${anonAdmin.location}`
  );

  const anonAccount = await get("/account/orders");
  check(
    "anon /account/orders bounces to login with callbackUrl",
    [302, 307].includes(anonAccount.status) &&
      (anonAccount.location ?? "").includes("/login?callbackUrl=%2Faccount%2Forders"),
    `${anonAccount.status} ${anonAccount.location}`
  );

  const missingRoute = await get("/definitely-missing");
  check("unknown route answers a real 404", missingRoute.status === 404, `${missingRoute.status}`);
  check("unknown route renders our 404 view", missingRoute.html.includes("Page not found"));

  const missingProduct = await get("/product/no-such-slug");
  check(
    "missing product renders our 404 view",
    missingProduct.html.includes("Page not found"),
    `status ${missingProduct.status}`
  );
  check(
    "streamed soft-404 is noindexed (loading.tsx status trade-off)",
    missingProduct.html.includes('<meta name="robots" content="noindex"'),
    `status ${missingProduct.status}`
  );

  const adminHome = await get("/admin", adminLogin.jar);
  check(
    "admin console ships no storefront header",
    !adminHome.html.includes('href="/cart"'),
    "Cart link leaked into /admin"
  );
  const home = await get("/");
  check("storefront keeps the header", home.html.includes('href="/cart"'));
  const loginPage = await get("/login");
  check("auth layout keeps the header", loginPage.html.includes('href="/cart"'));
  const accountOrders = await get("/account/orders", adminLogin.jar);
  check("account layout keeps the header", accountOrders.html.includes('href="/cart"'));

  // ── Phase 9: homepage, header search, footer scoping, breadcrumbs ─────────
  check(
    "homepage is not create-next-app boilerplate",
    !home.html.includes("Deploy Now") && !home.html.includes("create-next-app"),
    "boilerplate leaked into /"
  );
  check("homepage hero links to /shop", home.html.includes('href="/shop"'));
  check("homepage renders the footer", home.html.includes("<footer"));
  check(
    "header ships a search form posting to /search",
    home.html.includes('action="/search"') && home.html.includes('name="search"')
  );
  check("auth layout renders the footer", loginPage.html.includes("<footer"));
  check("account layout renders the footer", accountOrders.html.includes("<footer"));
  check(
    "admin console ships no storefront footer",
    !adminHome.html.includes("<footer"),
    "Footer leaked into /admin"
  );
  const shopPage = await get("/shop");
  check(
    "shop renders breadcrumbs",
    shopPage.html.includes('aria-label="Breadcrumb"'),
    `status ${shopPage.status}`
  );
}

// ── 14. Phase 10: reviews — verified buyers, one row, moderation ────────────
const reviewOrderNumber = `GIR-REV${TS.toString(16).padStart(12, "0").slice(-12)}`;
let reviewOrder = null;
{
  const productPath = `/product/${fixtureProduct.slug}`;
  const REVIEW_TEXT = "E2E review — gorgeous bouquet and fast delivery.";
  const reviewInput = {
    productId: fixtureProduct.id,
    slug: fixtureProduct.slug,
    rating: 5,
    text: REVIEW_TEXT,
  };

  check(
    "submitReview action id resolved",
    Boolean(ids.submitReview),
    "missing from server-reference-manifest.json"
  );
  check(
    "setReviewStatus action id resolved",
    Boolean(ids.setReviewStatus),
    "missing from server-reference-manifest.json"
  );

  // Anon: sign-in prompt, no form, no empty-state review list.
  const anonProduct = await get(productPath);
  check(
    "anon product page prompts sign-in to review",
    anonProduct.html.includes("to review this product"),
    "anon review prompt missing"
  );
  check(
    "product page renders the reviews section",
    anonProduct.html.includes('id="reviews-heading"'),
    "reviews heading missing"
  );
  check(
    "no approved reviews → empty-state copy",
    anonProduct.html.includes("No reviews yet"),
    "empty-state copy missing"
  );
  const anonSubmit = await callAction(productPath, ids.submitReview, [reviewInput]);
  check(
    "anon submitReview refused",
    anonSubmit.json?.success === false && /sign in/i.test(anonSubmit.json?.error ?? ""),
    JSON.stringify(anonSubmit.json)
  );

  // Signed-in non-buyer: a valid payload still can't pass the purchase gate.
  const nonBuyerJar = newJar();
  const nonBuyerLogin = await callAction("/login", ids.login, [
    { email: newUser.email, password: "password123" },
  ], nonBuyerJar);
  check(
    "non-buyer can sign in",
    nonBuyerLogin.json?.success === true && nonBuyerJar.has("authjs.session-token"),
    JSON.stringify(nonBuyerLogin.json)
  );
  const nonBuyerSubmit = await callAction(productPath, ids.submitReview, [reviewInput], nonBuyerJar);
  check(
    "signed-in non-buyer submitReview refused",
    nonBuyerSubmit.json?.success === false && /verified buyers/i.test(nonBuyerSubmit.json?.error ?? ""),
    JSON.stringify(nonBuyerSubmit.json)
  );

  // Make the customer a verified buyer: an order containing the fixture.
  reviewOrder = await db.order.create({
    data: {
      orderNumber: reviewOrderNumber,
      customerName: "Review Buyer",
      customerEmail: CUSTOMER.email,
      customerPhone: "03001234567",
      shippingAddress: "1 Test Street",
      shippingCity: "Karachi",
      subtotal: 180000,
      total: 180000,
      paymentMethod: "COD",
      orderStatus: "CONFIRMED",
      userId: customer.id,
      items: {
        create: {
          variationId: V_SMALL,
          productName: FIXTURE_NAME,
          variationName: "Small Bouquet",
          unitPrice: 180000,
          quantity: 1,
          subtotal: 180000,
        },
      },
    },
  });
  const buyerSubmit = await callAction(productPath, ids.submitReview, [reviewInput], loginJar);
  check(
    "verified buyer submitReview → success",
    buyerSubmit.json?.success === true,
    JSON.stringify(buyerSubmit.json)
  );
  const pendingRow = await db.review.findFirst({
    where: { productId: fixtureProduct.id, userId: customer.id },
  });
  check(
    "review stored PENDING for moderation",
    pendingRow?.status === "PENDING",
    `${pendingRow?.status}`
  );

  // PENDING never leaks to the storefront; only the author sees the note.
  // Scoped slices: neighbouring cards/reviews may carry their own ratings.
  const pendingPage = await get(productPath, loginJar);
  const pendingHeadingAt = pendingPage.html.indexOf('id="reviews-heading"');
  const pendingSummarySlice =
    pendingHeadingAt >= 0 ? pendingPage.html.slice(pendingHeadingAt, pendingHeadingAt + 600) : "";
  check(
    "pending review hidden from the product page",
    !visibleHtml(pendingPage.html).includes(REVIEW_TEXT),
    "pending text leaked"
  );
  check(
    "author sees the awaiting-approval note",
    pendingPage.html.includes("Your review is awaiting approval"),
    "moderation note missing"
  );
  check(
    "no star summary while the only review is pending",
    !pendingSummarySlice.includes('aria-label="Rated'),
    pendingSummarySlice.slice(0, 300)
  );
  const anonAfterPending = await get(productPath);
  check(
    "anonymous visitor never sees the pending review",
    !anonAfterPending.html.includes(REVIEW_TEXT),
    "pending text leaked to anon"
  );

  // Admin moderation queue: render, filter, approve.
  const anonReviews = await get("/admin/reviews");
  check(
    "anon GET /admin/reviews → login with callbackUrl",
    anonReviews.status >= 300 && anonReviews.status < 400 &&
      (anonReviews.location ?? "").includes("/login?callbackUrl=%2Fadmin%2Freviews"),
    `${anonReviews.status} ${anonReviews.location}`
  );
  const reviewsPage = await get("/admin/reviews", adminLogin.jar);
  check(
    "admin /admin/reviews renders",
    reviewsPage.status === 200,
    `${reviewsPage.status}`
  );
  check(
    "moderation queue lists the pending review",
    reviewsPage.html.includes(REVIEW_TEXT),
    "pending review missing from queue"
  );
  const approve = await callAction(
    "/admin/reviews",
    ids.setReviewStatus,
    [pendingRow?.id ?? "", "APPROVED"],
    adminLogin.jar
  );
  check(
    "setReviewStatus APPROVED → success",
    approve.json?.success === true,
    JSON.stringify(approve.json)
  );

  // Approved: visible, rated, attributed to the author as "(You)".
  const approvedPage = await get(productPath, loginJar);
  const approvedHeadingAt = approvedPage.html.indexOf('id="reviews-heading"');
  const approvedSummarySlice =
    approvedHeadingAt >= 0 ? approvedPage.html.slice(approvedHeadingAt, approvedHeadingAt + 600) : "";
  check(
    "approved review is visible on the product page",
    approvedPage.html.includes(REVIEW_TEXT),
    "approved text missing"
  );
  check(
    "rating summary renders after approval",
    approvedSummarySlice.includes('aria-label="Rated 5 out of 5 from 1 review"'),
    approvedSummarySlice.slice(0, 300)
  );
  check(
    "the author's own review is tagged (You)",
    approvedPage.html.includes("(You)"),
    "(You) marker missing"
  );
  const anonApproved = await get(productPath);
  check(
    "approved review is public",
    anonApproved.html.includes(REVIEW_TEXT),
    "approved text not public"
  );
  const shopApproved = await get("/shop");
  const cardAt = shopApproved.html.indexOf(`${FIXTURE_NAME}</h3>`);
  const cardSlice = cardAt >= 0 ? shopApproved.html.slice(cardAt, cardAt + 500) : "";
  check(
    "shop card shows the star line after approval",
    cardSlice.includes('aria-label="Rated 5 out of 5 from 1 review"'),
    cardSlice.slice(0, 300)
  );

  // Resubmission: upserts ONE row and re-enters moderation.
  const UPDATE_TEXT = "Changed my mind after washing it twice.";
  const resubmit = await callAction(
    productPath,
    ids.submitReview,
    [{ ...reviewInput, rating: 1, text: UPDATE_TEXT }],
    loginJar
  );
  check(
    "author resubmit → success",
    resubmit.json?.success === true,
    JSON.stringify(resubmit.json)
  );
  const rowsForUser = await db.review.count({
    where: { productId: fixtureProduct.id, userId: customer.id },
  });
  check("one review row per user per product", rowsForUser === 1, `${rowsForUser}`);
  const updatedRow = await db.review.findFirst({
    where: { productId: fixtureProduct.id, userId: customer.id },
  });
  check(
    "resubmit resets the row to PENDING",
    updatedRow?.status === "PENDING" && updatedRow?.rating === 1,
    `${updatedRow?.status} rating=${updatedRow?.rating}`
  );
  const afterResubmit = await get(productPath, loginJar);
  check(
    "updated review is hidden again until re-approved",
    !visibleHtml(afterResubmit.html).includes(UPDATE_TEXT),
    "re-pending text leaked"
  );

  // Reject: stays out of the storefront, leaves the pending queue.
  const reject = await callAction(
    "/admin/reviews",
    ids.setReviewStatus,
    [updatedRow?.id ?? "", "REJECTED"],
    adminLogin.jar
  );
  check(
    "setReviewStatus REJECTED → success",
    reject.json?.success === true,
    JSON.stringify(reject.json)
  );
  const rejectedPage = await get(productPath);
  const authorAfterReject = await get(productPath, loginJar);
  check(
    "rejected review never renders publicly",
    !rejectedPage.html.includes(UPDATE_TEXT),
    "rejected text leaked"
  );
  check(
    "rejected review never renders for the author",
    !visibleHtml(authorAfterReject.html).includes(UPDATE_TEXT),
    "rejected text leaked to author"
  );
  const pendingTab = await get("/admin/reviews?status=PENDING", adminLogin.jar);
  check(
    "status=PENDING tab renders and excludes the rejected row",
    pendingTab.status === 200 && !pendingTab.html.includes(UPDATE_TEXT),
    `${pendingTab.status}`
  );
  const rejectedTab = await get("/admin/reviews?status=REJECTED", adminLogin.jar);
  check(
    "status=REJECTED tab lists the rejected row",
    rejectedTab.status === 200 && rejectedTab.html.includes(UPDATE_TEXT),
    `${rejectedTab.status}`
  );
}

// ── 15. Phase 11: admin catalog — images, variation create, category CRUD ──
let p11Product = null;
let p11Order = null;
{
  for (const name of [
    "createCategory",
    "deleteCategory",
    "createVariation",
    "uploadProductImage",
    "deleteProductImage",
    "moveProductImage",
    "deleteProduct",
  ]) {
    check(
      `${name} action id resolved`,
      Boolean(ids[name]),
      "missing from server-reference-manifest.json"
    );
  }

  const catPage = await get("/admin/categories", adminLogin.jar);
  check("admin /admin/categories renders", catPage.status === 200, `${catPage.status}`);

  // Category create → row + rendered list + offered by the product form.
  const P11_CAT = { name: `E2E P11 Cat ${TS}`, slug: `e2e-p11-cat-${TS}` };
  const createCat = await callAction(
    "/admin/categories",
    ids.createCategory,
    [P11_CAT],
    adminLogin.jar
  );
  check("createCategory → success", createCat.json?.success === true, JSON.stringify(createCat.json));
  const catRow = await db.category.findUnique({ where: { slug: P11_CAT.slug } });
  check("createCategory stores the row", Boolean(catRow), "row missing");
  const catListAfter = await get("/admin/categories", adminLogin.jar);
  check(
    "category list shows the new category",
    catListAfter.html.includes(P11_CAT.slug),
    "slug missing from list"
  );
  const newProductPage = await get("/admin/products/new", adminLogin.jar);
  check(
    "product form offers inline category creation",
    newProductPage.html.includes("＋ New category…"),
    "option missing"
  );
  check(
    "product form lists the new category",
    newProductPage.html.includes(P11_CAT.slug),
    "slug missing from select"
  );

  // In-use refusal (the reused fixture category owns products) …
  const inUse = await callAction(
    "/admin/categories",
    ids.deleteCategory,
    [category.id],
    adminLogin.jar
  );
  check(
    "deleteCategory refuses an in-use category",
    inUse.json?.success === false && /still use this category/i.test(inUse.json?.error ?? ""),
    JSON.stringify(inUse.json)
  );
  // … then the empty one deletes cleanly.
  const delCat = await callAction(
    "/admin/categories",
    ids.deleteCategory,
    [catRow?.id ?? ""],
    adminLogin.jar
  );
  check("deleteCategory removes an empty category", delCat.json?.success === true, JSON.stringify(delCat.json));
  const catListFinal = await get("/admin/categories", adminLogin.jar);
  check(
    "deleted category is gone from the list",
    !catListFinal.html.includes(P11_CAT.slug),
    "slug still rendered"
  );

  // Product detail: images section + variation create form.
  const detailPath = `/admin/products/${fixtureProduct.id}`;
  const detailPage = await get(detailPath, adminLogin.jar);
  check(
    "product detail renders the images section",
    detailPage.html.includes('id="images-heading"'),
    "images heading missing"
  );
  check("product detail offers Add variation", detailPage.html.includes("Add variation"), "button missing");

  // Variation create: rupees in, integer paisa stored, storefront shows it.
  const P11_VAR = {
    productId: fixtureProduct.id,
    name: `E2E XL Bouquet ${TS}`,
    price: 1800.5,
    stock: 4,
    isEnabled: true,
  };
  const createVar = await callAction(detailPath, ids.createVariation, [P11_VAR], adminLogin.jar);
  check("createVariation → success", createVar.json?.success === true, JSON.stringify(createVar.json));
  const varRow = await db.productVariation.findFirst({ where: { name: P11_VAR.name } });
  check(
    "createVariation stores rupees as integer paisa",
    varRow?.price === 180050 && varRow?.stock === 4,
    `price=${varRow?.price} stock=${varRow?.stock}`
  );
  const storePage = await get(`/product/${fixtureProduct.slug}`);
  check(
    "new variation appears on the storefront",
    storePage.html.includes(P11_VAR.name),
    "variation name missing"
  );

  // Images: two rows for reorder/delete; uploads go over flight multipart.
  const seed1 = await db.productImage.create({
    data: {
      productId: fixtureProduct.id,
      url: "https://res.cloudinary.com/demo/image/upload/v1700000000/girah/e2e-a.jpg",
      sortOrder: 0,
    },
  });
  const seed2 = await db.productImage.create({
    data: {
      productId: fixtureProduct.id,
      url: "https://res.cloudinary.com/demo/image/upload/v1700000000/girah/e2e-b.jpg",
      sortOrder: 1,
    },
  });

  const badForm = new FormData();
  badForm.set("productId", fixtureProduct.id);
  badForm.set("file", new File(["not an image"], "evil.txt", { type: "text/plain" }));
  const badUpload = await callActionFormData(detailPath, ids.uploadProductImage, badForm, adminLogin.jar);
  check(
    "uploadProductImage refuses a .txt file",
    badUpload.json?.success === false && /JPEG, PNG, WebP, AVIF or GIF/i.test(badUpload.json?.error ?? ""),
    JSON.stringify(badUpload.json)
  );
  const imageCountAfterRefusal = await db.productImage.count({
    where: { productId: fixtureProduct.id },
  });
  check("refused upload stores no row", imageCountAfterRefusal === 2, `${imageCountAfterRefusal}`);

  // Real upload only where usable credentials exist — CI injects placeholder
  // stand-ins (CLOUDINARY_API_KEY: "0") mirroring .env.example, so the key
  // check keeps that run honest without ever calling Cloudinary for real.
  const hasRealCloudinary =
    Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(process.env.CLOUDINARY_API_KEY) &&
    process.env.CLOUDINARY_API_KEY !== "0";
  if (hasRealCloudinary) {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const okForm = new FormData();
    okForm.set("productId", fixtureProduct.id);
    okForm.set("file", new File([png], "pixel.png", { type: "image/png" }));
    const okUpload = await callActionFormData(detailPath, ids.uploadProductImage, okForm, adminLogin.jar);
    check("real Cloudinary upload → success", okUpload.json?.success === true, JSON.stringify(okUpload.json));
    const uploaded = await db.productImage.findFirst({
      where: {
        productId: fixtureProduct.id,
        id: { notIn: [seed1.id, seed2.id] },
      },
    });
    check(
      "real upload stores a res.cloudinary.com URL",
      Boolean(uploaded) && uploaded.url.includes("res.cloudinary.com"),
      uploaded?.url ?? "row missing"
    );
  } else {
    check("real Cloudinary upload (skipped — placeholder or missing credentials)", true, "skipped");
  }

  // Reorder via the action: gapless sortOrder either way.
  const moveFirst = await callAction(
    detailPath,
    ids.moveProductImage,
    [seed2.id, "first"],
    adminLogin.jar
  );
  check("moveProductImage(first) → success", moveFirst.json?.success === true, JSON.stringify(moveFirst.json));
  const afterFirst = await db.productImage.findMany({
    where: { productId: fixtureProduct.id },
    orderBy: { sortOrder: "asc" },
  });
  check(
    "move first pins the image at sortOrder 0",
    afterFirst[0]?.id === seed2.id && afterFirst.every((row, i) => row.sortOrder === i),
    JSON.stringify(afterFirst.map((row) => [row.sortOrder, row.id === seed2.id]))
  );
  const moveLast = await callAction(
    detailPath,
    ids.moveProductImage,
    [seed2.id, "last"],
    adminLogin.jar
  );
  check("moveProductImage(last) → success", moveLast.json?.success === true, JSON.stringify(moveLast.json));
  const afterLast = await db.productImage.findMany({
    where: { productId: fixtureProduct.id },
    orderBy: { sortOrder: "asc" },
  });
  check(
    "move last appends the image with gapless order",
    afterLast[afterLast.length - 1]?.id === seed2.id &&
      afterLast.every((row, i) => row.sortOrder === i),
    JSON.stringify(afterLast.map((row) => [row.sortOrder, row.id === seed2.id]))
  );

  const delImg = await callAction(
    detailPath,
    ids.deleteProductImage,
    [seed1.id],
    adminLogin.jar
  );
  check("deleteProductImage → success", delImg.json?.success === true, JSON.stringify(delImg.json));
  check(
    "deleted image row is gone",
    (await db.productImage.findUnique({ where: { id: seed1.id } })) === null,
    "row still present"
  );

  // Admin list: cover thumbnail + delete. Node builds run the next/image
  // optimizer (src="/_next/image?url=…"); the Cloudflare build sets
  // images.unoptimized by design, so there the thumbnail is the raw
  // <img alt="<product name>"> instead — accept either form.
  const listPage = await get("/admin/products", adminLogin.jar);
  const fixtureRowAt = listPage.html.indexOf(FIXTURE_NAME);
  check(
    "product list renders the cover thumbnail",
    fixtureRowAt >= 0 &&
      (listPage.html.includes("/_next/image?url=") ||
        listPage.html.includes(`alt="${FIXTURE_NAME}"`)),
    `fixtureRowAt=${fixtureRowAt}`
  );
  check(
    "product list offers a delete button",
    /Delete<\/button>/.test(listPage.html),
    "delete button missing"
  );

  // deleteProduct: refuses while an order references it, deletes once freed.
  p11Product = await db.product.create({
    data: {
      name: `E2E P11 Delete ${TS}`,
      slug: `e2e-p11-delete-${TS}`,
      description: "Phase 11 deleteProduct fixture.",
      categoryId: category.id,
      variations: { create: [{ name: "Standard", price: 10000, stock: 3, isEnabled: true }] },
    },
    include: { variations: true },
  });
  p11Order = await db.order.create({
    data: {
      orderNumber: `GIR-P11${TS.toString(16).padStart(12, "0").slice(-12)}`,
      customerName: "E2E P11",
      customerEmail: "e2e-p11@example.com",
      customerPhone: "03001234567",
      shippingAddress: "1 Test Street",
      shippingCity: "Karachi",
      subtotal: 10000,
      total: 10000,
      paymentMethod: "COD",
      items: {
        create: {
          variationId: p11Product.variations[0].id,
          productName: p11Product.name,
          variationName: "Standard",
          unitPrice: 10000,
          quantity: 1,
          subtotal: 10000,
        },
      },
    },
  });
  const refuseDelete = await callAction(
    "/admin/products",
    ids.deleteProduct,
    [p11Product.id],
    adminLogin.jar
  );
  check(
    "deleteProduct refuses a product referenced by an order",
    refuseDelete.json?.success === false && /orders or carts/i.test(refuseDelete.json?.error ?? ""),
    JSON.stringify(refuseDelete.json)
  );
  await db.order.delete({ where: { id: p11Order.id } });
  const doDelete = await callAction(
    "/admin/products",
    ids.deleteProduct,
    [p11Product.id],
    adminLogin.jar
  );
  check(
    "deleteProduct removes an unreferenced product",
    doDelete.json?.success === true &&
      (await db.product.findUnique({ where: { id: p11Product.id } })) === null,
    JSON.stringify(doDelete.json)
  );
}

// ── 16. Phase 12: account completion — addresses, cancel/reorder, receipt ──
const p12Orders = [];
{
  for (const name of ["cancelMyOrder", "reorderOrder", "saveShippingAddress", "deleteShippingAddress"]) {
    check(`action id resolved: ${name}`, Boolean(ids[name]), "missing from server-reference-manifest.json");
  }

  // --- saved shipping address -------------------------------------------
  const anonAddresses = await get("/account/addresses");
  check(
    "anon GET /account/addresses → /login",
    anonAddresses.status >= 300 && anonAddresses.status < 400 && (anonAddresses.location ?? "").includes("/login"),
    `${anonAddresses.status} ${anonAddresses.location}`
  );

  const addressesPage = await get("/account/addresses", loginJar);
  check(
    "/account/addresses renders the address form",
    addressesPage.status === 200 &&
      addressesPage.html.includes("Shipping Address") &&
      addressesPage.html.includes('name="fullName"'),
    `${addressesPage.status}`
  );

  const SAVED = {
    fullName: "E2E Saved",
    phone: "03001112233",
    address: "9 E2E Lane",
    city: "Islamabad",
    postalCode: "44000",
  };
  const firstSave = await callAction("/account/addresses", ids.saveShippingAddress, [SAVED], loginJar);
  check("saveShippingAddress → success", firstSave.json?.success === true, JSON.stringify(firstSave.json));
  let savedRow = await db.savedShipping.findUnique({ where: { userId: customer.id } });
  check("saved address row exists", savedRow?.city === "Islamabad", JSON.stringify(savedRow));

  const secondSave = await callAction(
    "/account/addresses",
    ids.saveShippingAddress,
    [{ ...SAVED, city: "Lahore" }],
    loginJar
  );
  savedRow = await db.savedShipping.findUnique({ where: { userId: customer.id } });
  const savedCount = await db.savedShipping.count({ where: { userId: customer.id } });
  check(
    "second save UPDATES the single row",
    secondSave.json?.success === true && savedCount === 1 && savedRow?.city === "Lahore",
    `count=${savedCount} city=${savedRow?.city}`
  );

  // The proxy guards /account/* BEFORE the action runs — an anonymous POST
  // bounces to /login; the action's own session check is integration-tested.
  const anonSave = await callAction("/account/addresses", ids.saveShippingAddress, [SAVED], null);
  check(
    "save without a session is bounced to /login",
    anonSave.status >= 300 && anonSave.status < 400 && (anonSave.location ?? "").includes("/login"),
    `${anonSave.status} ${anonSave.location}`
  );

  // Checkout prefill — signed in, cart filled, saved row present.
  await seedUserCart(customer.id, [{ variationId: V_SMALL, quantity: 1 }]);
  const checkoutPage = await get("/checkout", loginJar);
  check(
    "checkout prefills the saved address fields",
    checkoutPage.html.includes('value="E2E Saved"') && checkoutPage.html.includes('value="9 E2E Lane"'),
    "prefill values missing from SSR"
  );
  check("checkout renders the save-address checkbox", checkoutPage.html.includes('name="saveAddress"'), "checkbox missing");

  // opt-out checkout must NOT touch the stored address…
  const placeNoSave = await callAction("/checkout", ids.placeOrder, [{ ...CHECKOUT, saveAddress: false }], loginJar);
  if (placeNoSave.json?.orderId) p12Orders.push(placeNoSave.json.orderId);
  savedRow = await db.savedShipping.findUnique({ where: { userId: customer.id } });
  check(
    "placeOrder(saveAddress:false) leaves the stored address alone",
    placeNoSave.json?.success === true && savedRow?.city === "Lahore",
    `success=${placeNoSave.json?.success} city=${savedRow?.city}`
  );

  // …and the opt-in checkout refreshes it AFTER the order commits.
  await seedUserCart(customer.id, [{ variationId: V_SINGLE, quantity: 1 }]);
  const placeSave = await callAction("/checkout", ids.placeOrder, [{ ...CHECKOUT, saveAddress: true }], loginJar);
  if (placeSave.json?.orderId) p12Orders.push(placeSave.json.orderId);
  savedRow = await db.savedShipping.findUnique({ where: { userId: customer.id } });
  check(
    "placeOrder(saveAddress:true) upserts the stored address",
    placeSave.json?.success === true && savedRow?.city === "Karachi",
    `success=${placeSave.json?.success} city=${savedRow?.city}`
  );

  const firstDelete = await callAction("/account/addresses", ids.deleteShippingAddress, [], loginJar);
  const secondDelete = await callAction("/account/addresses", ids.deleteShippingAddress, [], loginJar);
  check(
    "deleteShippingAddress removes the row and is idempotent",
    firstDelete.json?.success === true &&
      secondDelete.json?.success === true &&
      (await db.savedShipping.findUnique({ where: { userId: customer.id } })) === null,
    `${JSON.stringify(firstDelete.json)} / ${JSON.stringify(secondDelete.json)}`
  );

  // --- account shell: card, sub-nav, footer --------------------------------
  const accountPage = await get("/account", loginJar);
  check("dashboard renders the Shipping Address card", accountPage.html.includes('href="/account/addresses"'));
  check(
    "AccountNav marks Overview as current on /account",
    /<a[^>]*href="\/account"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/account"/.test(accountPage.html),
    "aria-current missing on the Overview tab"
  );
  const ordersList = await get("/account/orders", loginJar);
  check(
    "AccountNav marks Orders as current on /account/orders",
    /<a[^>]*href="\/account\/orders"[^>]*aria-current="page"|<a[^>]*aria-current="page"[^>]*href="\/account\/orders"/.test(
      ordersList.html
    ),
    "aria-current missing on the Orders tab"
  );
  const homeAgain = await get("/");
  check("footer links /account/addresses", homeAgain.html.includes('href="/account/addresses"'));

  // --- customer-owned order fixtures --------------------------------------
  const baseOrder = {
    userId: customer.id,
    customerName: "E2E Phase12",
    customerEmail: "e2e-p12@example.com",
    customerPhone: "03001234567",
    shippingAddress: "9 E2E Lane",
    shippingCity: "Islamabad",
    shippingPostal: "44000",
    subtotal: 180000,
    total: 180000,
    paymentMethod: "COD",
    items: {
      create: {
        variationId: V_SMALL,
        productName: FIXTURE_NAME,
        variationName: "Small Bouquet",
        unitPrice: 180000,
        quantity: 1,
        subtotal: 180000,
      },
    },
  };
  const unpaidOrder = await db.order.create({
    data: {
      ...baseOrder,
      orderNumber: `GIR-P12A${TS.toString(16).padStart(12, "0").slice(-12)}`,
      orderStatus: "PENDING",
      paymentStatus: "PENDING",
    },
  });
  const paidOrder = await db.order.create({
    data: {
      ...baseOrder,
      orderNumber: `GIR-P12B${TS.toString(16).padStart(12, "0").slice(-12)}`,
      orderStatus: "CONFIRMED",
      paymentStatus: "PAID",
    },
  });
  const processingOrder = await db.order.create({
    data: {
      ...baseOrder,
      orderNumber: `GIR-P12C${TS.toString(16).padStart(12, "0").slice(-12)}`,
      orderStatus: "PROCESSING",
      paymentStatus: "PENDING",
    },
  });
  p12Orders.push(unpaidOrder.id, paidOrder.id, processingOrder.id);

  // --- order detail + receipt ---------------------------------------------
  const detailPage = await get(`/account/orders/${unpaidOrder.id}`, loginJar);
  check(
    "order detail renders Cancel / Buy again / View receipt",
    detailPage.status === 200 &&
      detailPage.html.includes("Cancel order") &&
      detailPage.html.includes("Buy again") &&
      detailPage.html.includes("View receipt"),
    `${detailPage.status}`
  );
  check(
    "order detail withholds contact PII",
    !detailPage.html.includes("e2e-p12@example.com") && !detailPage.html.includes("03001234567"),
    "receipt-only PII leaked into the detail view"
  );

  const receiptPage = await get(`/account/orders/${unpaidOrder.id}/receipt`, loginJar);
  check(
    "receipt renders the invoice + print button",
    receiptPage.status === 200 &&
      receiptPage.html.includes("e2e-p12@example.com") &&
      receiptPage.html.includes("9 E2E Lane") &&
      receiptPage.html.includes("Print receipt"),
    `${receiptPage.status}`
  );
  check("receipt hides page chrome when printing", receiptPage.html.includes("print:hidden"), "print:hidden missing");

  const strangerReceipt = await get(`/account/orders/${unpaidOrder.id}/receipt`, adminLogin.jar);
  // loading.tsx streams the shell first — same soft-404 trade-off Phase 7
  // documented for /product/[slug]: assert our not-found VIEW, not the status.
  check(
    "stranger GET receipt renders the 404 view",
    strangerReceipt.html.includes("Page not found") && !strangerReceipt.html.includes("e2e-p12@example.com"),
    `${strangerReceipt.status}`
  );
  const anonReceipt = await get(`/account/orders/${unpaidOrder.id}/receipt`);
  check(
    "anon GET receipt → /login",
    anonReceipt.status >= 300 && anonReceipt.status < 400 && (anonReceipt.location ?? "").includes("/login"),
    `${anonReceipt.status} ${anonReceipt.location}`
  );
  const strangerDetail = await get(`/account/orders/${unpaidOrder.id}`, adminLogin.jar);
  check(
    "stranger GET order detail renders the 404 view",
    strangerDetail.html.includes("Page not found") && !strangerDetail.html.includes("e2e-p12@example.com"),
    `${strangerDetail.status}`
  );

  // --- cancel: refusals first, owner last ---------------------------------
  const paidCancel = await callAction(`/account/orders/${paidOrder.id}`, ids.cancelMyOrder, [paidOrder.id], loginJar);
  check(
    "cancel refuses a PAID order (no customer refund path)",
    paidCancel.json?.success === false && /already been paid/i.test(paidCancel.json?.error ?? ""),
    JSON.stringify(paidCancel.json)
  );
  const procCancel = await callAction(
    `/account/orders/${processingOrder.id}`,
    ids.cancelMyOrder,
    [processingOrder.id],
    loginJar
  );
  check(
    "cancel refuses a PROCESSING order",
    procCancel.json?.success === false && /already being prepared/i.test(procCancel.json?.error ?? ""),
    JSON.stringify(procCancel.json)
  );
  const strangerCancel = await callAction(
    `/account/orders/${unpaidOrder.id}`,
    ids.cancelMyOrder,
    [unpaidOrder.id],
    adminLogin.jar
  );
  check(
    "cancel by a stranger → generic not-found",
    strangerCancel.json?.success === false && strangerCancel.json?.error === "Order not found.",
    JSON.stringify(strangerCancel.json)
  );
  const anonCancel = await callAction(`/account/orders/${unpaidOrder.id}`, ids.cancelMyOrder, [unpaidOrder.id], null);
  check(
    "cancel without a session is bounced to /login",
    anonCancel.status >= 300 && anonCancel.status < 400 && (anonCancel.location ?? "").includes("/login"),
    `${anonCancel.status} ${anonCancel.location}`
  );

  const stockBefore = (await db.productVariation.findUniqueOrThrow({ where: { id: V_SMALL } })).stock;
  const cancel = await callAction(`/account/orders/${unpaidOrder.id}`, ids.cancelMyOrder, [unpaidOrder.id], loginJar);
  const stockAfter = (await db.productVariation.findUniqueOrThrow({ where: { id: V_SMALL } })).stock;
  check("owner cancels the unpaid order", cancel.json?.success === true, JSON.stringify(cancel.json));
  check(
    "cancelled order restocks the item",
    stockAfter === stockBefore + 1,
    `${stockBefore} → ${stockAfter}`
  );
  const cancelledRow = await db.order.findUniqueOrThrow({ where: { id: unpaidOrder.id } });
  check("order is CANCELLED in the DB", cancelledRow.orderStatus === "CANCELLED", cancelledRow.orderStatus);
  const auditRow = await db.stockAdjustment.findFirst({ where: { reason: { contains: "cancelled by customer" } } });
  check("restock audit row is customer-attributed (adminId null)", Boolean(auditRow) && auditRow.adminId === null);

  const afterCancel = await get(`/account/orders/${unpaidOrder.id}`, loginJar);
  check("cancelled order hides the Cancel button", !afterCancel.html.includes("Cancel order"), "Cancel button still rendered");
  check("cancelled order still offers Buy again", afterCancel.html.includes("Buy again"));

  // --- reorder ---------------------------------------------------------------
  const anonReorder = await callAction(`/account/orders/${paidOrder.id}`, ids.reorderOrder, [paidOrder.id], null);
  check(
    "reorder without a session is bounced to /login",
    anonReorder.status >= 300 && anonReorder.status < 400 && (anonReorder.location ?? "").includes("/login"),
    `${anonReorder.status} ${anonReorder.location}`
  );
  const strangerReorder = await callAction(
    `/account/orders/${paidOrder.id}`,
    ids.reorderOrder,
    [paidOrder.id],
    adminLogin.jar
  );
  check(
    "reorder by a stranger → generic not-found",
    strangerReorder.json?.success === false && strangerReorder.json?.error === "Order not found.",
    JSON.stringify(strangerReorder.json)
  );

  await wipeUserCart(customer.id);
  const reorder = await callAction(`/account/orders/${paidOrder.id}`, ids.reorderOrder, [paidOrder.id], loginJar);
  check(
    "reorder replays the order lines into the cart",
    reorder.json?.success === true && reorder.json?.added >= 1,
    JSON.stringify(reorder.json)
  );
  const reorderCart = await db.cart.findUnique({ where: { userId: customer.id }, include: { items: true } });
  check(
    "cart carries the reordered line",
    Boolean(reorderCart?.items.find((i) => i.variationId === V_SMALL)),
    JSON.stringify(reorderCart?.items ?? null)
  );
}

// ── 17. Phase 13: admin ops & dashboard — filters, detail, refund, stock ────
const p13Orders = [];
{
  check(
    "action id resolved: refundOrderPayment",
    Boolean(ids.refundOrderPayment),
    "missing from server-reference-manifest.json"
  );

  // Fixtures: filter pair (unique order numbers) + one order per refund path.
  const base = {
    customerName: "E2E Phase 13",
    customerEmail: "e2e-p13@example.com",
    customerPhone: "03001234567",
    shippingAddress: "1 Test Street",
    shippingCity: "Karachi",
    subtotal: 100000,
    total: 100000,
  };
  const shippedRow = await db.order.create({
    data: { ...base, orderNumber: `GIR-P13S-${TS}`, orderStatus: "SHIPPED", paymentMethod: "COD", paymentStatus: "PENDING" },
  });
  const pendingRow = await db.order.create({
    data: { ...base, orderNumber: `GIR-P13P-${TS}`, orderStatus: "PENDING", paymentMethod: "COD", paymentStatus: "PENDING" },
  });
  const codPaid = await db.order.create({
    data: { ...base, orderNumber: `GIR-P13C-${TS}`, orderStatus: "CONFIRMED", paymentMethod: "COD", paymentStatus: "PAID" },
  });
  const safepayNoTracker = await db.order.create({
    data: { ...base, orderNumber: `GIR-P13N-${TS}`, paymentMethod: "SAFEPAY", paymentStatus: "PAID" },
  });
  const safepayFakeTracker = await db.order.create({
    data: {
      ...base,
      orderNumber: `GIR-P13F-${TS}`,
      paymentMethod: "SAFEPAY",
      paymentStatus: "PAID",
      safepayTracker: `e2e-fake-tracker-${TS}`,
    },
  });
  p13Orders.push(shippedRow.id, pendingRow.id, codPaid.id, safepayNoTracker.id, safepayFakeTracker.id);

  // --- dashboard (server-rendered KPIs + SVG chart, zero client JS) ---------
  const dash = await get("/admin", adminLogin.jar);
  check("admin dashboard renders", dash.status === 200, `${dash.status}`);
  check(
    "dashboard shows KPI cards and list sections",
    dash.html.includes("Orders · 30d") &&
      dash.html.includes("Low stock") &&
      dash.html.includes("Orders by status") &&
      dash.html.includes("Recent orders"),
    "missing dashboard sections"
  );
  check(
    "dashboard renders an accessible revenue chart (or its empty state)",
    (dash.html.includes('role="img"') && dash.html.includes("Daily paid revenue")) ||
      dash.html.includes("No paid orders in the last 14 days."),
    "no chart and no empty state"
  );
  check("admin nav links the Stock page", dash.html.includes('href="/admin/stock"'), "nav item missing");

  // --- orders filters (tabs + search, each preserving the other) -----------
  const tabbed = await get("/admin/orders?status=SHIPPED", adminLogin.jar);
  check(
    "status tab keeps only matching orders and marks itself active",
    tabbed.status === 200 &&
      tabbed.html.includes(shippedRow.orderNumber) &&
      !tabbed.html.includes(pendingRow.orderNumber) &&
      tabbed.html.includes('aria-current="page"'),
    `${tabbed.status}`
  );
  const searched = await get(`/admin/orders?search=${shippedRow.orderNumber}`, adminLogin.jar);
  check(
    "search narrows to one order number",
    searched.status === 200 &&
      searched.html.includes(shippedRow.orderNumber) &&
      !searched.html.includes(pendingRow.orderNumber),
    `${searched.status}`
  );
  const combined = await get(
    `/admin/orders?status=SHIPPED&search=${shippedRow.orderNumber}`,
    adminLogin.jar
  );
  check(
    "search form preserves the active status tab",
    combined.html.includes('<input type="hidden" name="status" value="SHIPPED"') &&
      combined.html.includes(shippedRow.orderNumber),
    "status hidden input missing"
  );
  const bogusTab = await get("/admin/orders?status=NOT_A_STATUS", adminLogin.jar);
  check(
    "unknown status is ignored, not an error",
    bogusTab.status === 200 &&
      bogusTab.html.includes(shippedRow.orderNumber) &&
      bogusTab.html.includes(pendingRow.orderNumber),
    `${bogusTab.status}`
  );

  // --- order detail page ---------------------------------------------------
  const detail = await get(`/admin/orders/${shippedRow.id}`, adminLogin.jar);
  check(
    "admin order detail renders items, delivery and payment blocks",
    detail.status === 200 &&
      detail.html.includes(shippedRow.orderNumber) &&
      detail.html.includes("Delivery") &&
      detail.html.includes("Payment") &&
      detail.html.includes("Items"),
    `${detail.status}`
  );
  check(
    "a non-PAID detail page offers no Refund button",
    !detail.html.includes("Refund</button>"),
    "refund button rendered for a PENDING payment"
  );
  const paidDetail = await get(`/admin/orders/${codPaid.id}`, adminLogin.jar);
  check("a PAID detail page offers Refund", paidDetail.html.includes("Refund</button>"), "refund button missing");
  const ordersList = await get("/admin/orders", adminLogin.jar);
  check(
    "orders list never offers the refund control (detail-page-only)",
    !ordersList.html.includes("Refund</button>"),
    "refund button leaked into the list"
  );

  const anonDetail = await get(`/admin/orders/${shippedRow.id}`);
  check(
    "anon order detail bounces to login with callbackUrl",
    [302, 307].includes(anonDetail.status) &&
      (anonDetail.location ?? "").includes(`/login?callbackUrl=%2Fadmin%2Forders%2F${shippedRow.id}`),
    `${anonDetail.status} ${anonDetail.location}`
  );
  const customerDetail = await get(`/admin/orders/${shippedRow.id}`, loginJar);
  const customerLoc = (customerDetail.location ?? "").replace(BASE, "");
  check(
    "signed-in customer order detail redirects home, not to login",
    [302, 307].includes(customerDetail.status) && customerLoc === "/",
    `${customerDetail.status} ${customerDetail.location}`
  );
  // Signed in so the proxy doesn't answer first (anon → /login, as checked above).
  const missingDetail = await get(`/admin/orders/no-such-order-${TS}`, adminLogin.jar);
  check(
    "unknown order id renders our 404 view",
    missingDetail.html.includes("Page not found"),
    `status ${missingDetail.status}`
  );

  // --- refund guards over the wire -----------------------------------------
  const anonRefund = await callAction("/admin/orders", ids.refundOrderPayment, [codPaid.id], null);
  check(
    "anonymous refund POST is bounced to /login by the proxy",
    anonRefund.status >= 300 && anonRefund.status < 400 && (anonRefund.location ?? "").includes("/login"),
    `${anonRefund.status} ${anonRefund.location}`
  );
  const customerRefund = await callAction("/admin/orders", ids.refundOrderPayment, [codPaid.id], loginJar);
  const refundLoc = (customerRefund.location ?? "").replace(BASE, "");
  check(
    "customer refund POST redirects home (never reaches the action)",
    customerRefund.status >= 300 && customerRefund.status < 400 && refundLoc === "/",
    `${customerRefund.status} ${customerRefund.location}`
  );
  const pendingRefund = await callAction("/admin/orders", ids.refundOrderPayment, [pendingRow.id], adminLogin.jar);
  check(
    "refunding a PENDING payment is refused with the status named",
    pendingRefund.json?.success === false && /Only a PAID payment can be refunded/.test(pendingRefund.json?.error ?? ""),
    JSON.stringify(pendingRefund.json)
  );
  const noTrackerRefund = await callAction(
    "/admin/orders",
    ids.refundOrderPayment,
    [safepayNoTracker.id],
    adminLogin.jar
  );
  const noTrackerRow = await db.order.findUnique({ where: { id: safepayNoTracker.id } });
  check(
    "SAFEPAY PAID without a tracker is refused, order untouched",
    noTrackerRefund.json?.success === false &&
      /no Safepay payment reference/.test(noTrackerRefund.json?.error ?? "") &&
      noTrackerRow?.paymentStatus === "PAID",
    JSON.stringify(noTrackerRefund.json)
  );
  const fakeTrackerRefund = await callAction(
    "/admin/orders",
    ids.refundOrderPayment,
    [safepayFakeTracker.id],
    adminLogin.jar
  );
  const fakeTrackerRow = await db.order.findUnique({ where: { id: safepayFakeTracker.id } });
  check(
    "SAFEPAY refund attempt against the real API refuses before any state change",
    fakeTrackerRefund.json?.success === false &&
      /Safepay rejected the refund/.test(fakeTrackerRefund.json?.error ?? "") &&
      fakeTrackerRow?.paymentStatus === "PAID",
    JSON.stringify(fakeTrackerRefund.json)
  );

  // --- refund success: money back, order kept -------------------------------
  const auditBefore = await db.stockAdjustment.count();
  const codRefund = await callAction("/admin/orders", ids.refundOrderPayment, [codPaid.id], adminLogin.jar);
  const codAfter = await db.order.findUnique({ where: { id: codPaid.id } });
  const auditAfter = await db.stockAdjustment.count();
  check("COD PAID refund succeeds over the wire", codRefund.json?.success === true, JSON.stringify(codRefund.json));
  check(
    "refund flips paymentStatus but KEEPS the order (status + no restock)",
    codAfter?.paymentStatus === "REFUNDED" &&
      codAfter?.orderStatus === "CONFIRMED" &&
      auditAfter === auditBefore,
    JSON.stringify({ paymentStatus: codAfter?.paymentStatus, orderStatus: codAfter?.orderStatus })
  );
  const doubleRefund = await callAction("/admin/orders", ids.refundOrderPayment, [codPaid.id], adminLogin.jar);
  check(
    "a second refund is refused (already refunded)",
    doubleRefund.json?.success === false && doubleRefund.json?.error === "This payment has already been refunded.",
    JSON.stringify(doubleRefund.json)
  );
  const refundedDetail = await get(`/admin/orders/${codPaid.id}`, adminLogin.jar);
  check(
    "detail page reflects the refunded payment",
    /Payment:\s*(?:<!-- -->)?REFUNDED/.test(refundedDetail.html),
    "payment state not rendered"
  );

  // --- stock audit feed -----------------------------------------------------
  const stockPage = await get("/admin/stock", adminLogin.jar);
  check("admin stock page renders", stockPage.status === 200 && stockPage.html.includes("Stock history"), `${stockPage.status}`);
  const stockReason = `E2E P13 stock ${TS}`;
  await db.stockAdjustment.create({
    data: {
      variationId: V_SMALL,
      previousStock: 9,
      adjustment: -1,
      newStock: 8,
      reason: stockReason,
      adminId: null,
    },
  });
  const stockFeed = await get("/admin/stock", adminLogin.jar);
  check(
    "feed shows the adjustment with customer-cancel attribution",
    stockFeed.html.includes(stockReason) && stockFeed.html.includes("Customer (order cancel)"),
    "row missing from feed"
  );
  // Feed search matches product/variation names (not the reason text).
  const stockSearch = await get(`/admin/stock?search=${encodeURIComponent(FIXTURE_NAME)}`, adminLogin.jar);
  check("feed search narrows to the fixture product's rows", stockSearch.html.includes(stockReason), `${stockSearch.status}`);
  const stockNone = await get("/admin/stock?search=no-such-product-xyz", adminLogin.jar);
  check(
    "feed search empty state",
    stockNone.html.includes("No stock changes match"),
    `${stockNone.status}`
  );
}

// ── 18. Phase 14: forgot / reset password — pages, token lifecycle, login ──
{
  const p14Email = `e2e-p14-${TS}@example.com`;
  const p14User = await db.user.create({
    data: {
      email: p14Email,
      name: "E2E Reset",
      role: "CUSTOMER",
      passwordHash: await bcrypt.hash("OldPass123!", 10),
      isActive: true,
    },
  });

  const forgotPage = await get("/forgot-password");
  check(
    "forgot-password renders the request form",
    forgotPage.status === 200 && forgotPage.html.includes("Forgot Password") && forgotPage.html.includes('name="email"'),
    `${forgotPage.status}`
  );
  const resetBare = await get("/reset-password");
  check(
    "reset-password without a token shows the invalid message",
    resetBare.status === 200 && resetBare.html.includes("invalid or has expired"),
    `${resetBare.status}`
  );

  // Request → one hashed row; the raw token never exists client-side.
  const requestRes = await callAction("/forgot-password", ids.requestPasswordReset, [{ email: p14Email }]);
  check("requestPasswordReset → generic success", requestRes.json?.success === true, JSON.stringify(requestRes.json));
  const tokenRows = await db.passwordResetToken.findMany({ where: { userId: p14User.id } });
  check(
    "request stores exactly one sha256-hashed token",
    tokenRows.length === 1 && /^[0-9a-f]{64}$/.test(tokenRows[0].tokenHash),
    JSON.stringify(tokenRows.map((r) => r.tokenHash))
  );

  // Anti-enumeration: an unknown address answers byte-identically.
  const ghostEmail = `e2e-p14-ghost-${TS}@example.com`;
  const ghostRes = await callAction("/forgot-password", ids.requestPasswordReset, [{ email: ghostEmail }]);
  check(
    "unknown address gets the identical response",
    JSON.stringify(ghostRes.json) === JSON.stringify(requestRes.json),
    `${JSON.stringify(ghostRes.json)} vs ${JSON.stringify(requestRes.json)}`
  );
  const ghostRows = await db.passwordResetToken.count({ where: { user: { email: ghostEmail } } });
  check("unknown address stores no token", ghostRows === 0, String(ghostRows));

  // The raw token lives only in the dev-log email, so hand-craft the row
  // exactly the way the action would (hash of a known value).
  const rawToken = crypto.randomBytes(32).toString("hex");
  await db.passwordResetToken.deleteMany({ where: { userId: p14User.id } });
  await db.passwordResetToken.create({
    data: {
      userId: p14User.id,
      tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const resetWithToken = await get(`/reset-password?token=${rawToken}`);
  check(
    "reset-password with a token renders the new-password form",
    resetWithToken.status === 200 &&
      resetWithToken.html.includes('name="password"') &&
      resetWithToken.html.includes('name="confirmPassword"'),
    `${resetWithToken.status}`
  );

  const resetRes = await callAction("/reset-password", ids.resetPassword, [
    { token: rawToken, password: "NewPass456!", confirmPassword: "NewPass456!" },
  ]);
  check("resetPassword → success", resetRes.json?.success === true, JSON.stringify(resetRes.json));

  const after = await db.user.findUnique({ where: { id: p14User.id } });
  check(
    "the new password verifies and the old one no longer does",
    (await bcrypt.compare("NewPass456!", after.passwordHash)) &&
      !(await bcrypt.compare("OldPass123!", after.passwordHash)),
    "passwordHash not rotated"
  );
  check("reset bumped sessionVersion", after.sessionVersion === p14User.sessionVersion + 1, `${after.sessionVersion}`);
  const leftover = await db.passwordResetToken.count({ where: { userId: p14User.id } });
  check("reset consumed every token", leftover === 0, String(leftover));

  const reuse = await callAction("/reset-password", ids.resetPassword, [
    { token: rawToken, password: "Third789!", confirmPassword: "Third789!" },
  ]);
  check(
    "a consumed token cannot be reused",
    reuse.json?.success === false && /invalid or has expired/.test(reuse.json?.error ?? ""),
    JSON.stringify(reuse.json)
  );

  const bogus = await callAction("/reset-password", ids.resetPassword, [
    { token: crypto.randomBytes(32).toString("hex"), password: "Third789!", confirmPassword: "Third789!" },
  ]);
  check("an unknown token is refused", bogus.json?.success === false, JSON.stringify(bogus.json));

  const newLoginJar = newJar();
  const newLogin = await callAction("/login", ids.login, [{ email: p14Email, password: "NewPass456!" }], newLoginJar);
  check("the new password signs in", newLogin.json?.success === true, JSON.stringify(newLogin.json));
  check("the new password session cookie lands", newLoginJar.has("authjs.session-token"), [...newLoginJar.keys()].join(","));

  const oldLoginJar = newJar();
  const oldLogin = await callAction("/login", ids.login, [{ email: p14Email, password: "OldPass123!" }], oldLoginJar);
  check("the old password is rejected", oldLogin.json?.success === false, JSON.stringify(oldLogin.json));
  check("the rejected login establishes no session", !oldLoginJar.has("authjs.session-token"), [...oldLoginJar.keys()].join(","));

  // Cleanup (user deletion cascades any remaining tokens).
  await db.user.delete({ where: { id: p14User.id } }).catch(() => {});
}

// ── 19. Phase 15: /search results page + wishlist ──────────────────────────
{
  // Dedicated results page: heading, count, grid — through sanitizeFilters.
  const searchQ = `search=${encodeURIComponent(FIXTURE_NAME)}`;
  const resultsPage = await get(`/search?${searchQ}`);
  // React SSR escapes quotes in text nodes → `Results for &quot;…&quot;`.
  check(
    "search results render the heading with the query",
    resultsPage.status === 200 && resultsPage.html.includes(`Results for &quot;${FIXTURE_NAME}&quot;`),
    `${resultsPage.status}`
  );
  check("search results include the matching product", resultsPage.html.includes(FIXTURE_NAME), "fixture missing from grid");
  check(
    "search shows a single-product count line",
    resultsPage.html.includes(`1 product matching &quot;${FIXTURE_NAME}&quot;`),
    (resultsPage.html.match(/\d+ products? matching/) ?? ["no count line"])[0]
  );
  check(
    "search results keep the heart state wiring",
    resultsPage.html.includes("Add to wishlist") || resultsPage.html.includes("Remove from wishlist"),
    "no wishlist button rendered"
  );

  const nonsense = await get(`/search?search=${encodeURIComponent("zz-no-such-product-xyz")}`);
  check(
    "an empty result set shows the no-matches state",
    nonsense.status === 200 &&
      nonsense.html.includes("No matches") &&
      nonsense.html.includes("zz-no-such-product-xyz"),
    `${nonsense.status}`
  );

  const bareSearch = await get("/search");
  check("bare /search renders the default heading and form", bareSearch.status === 200 && bareSearch.html.includes(">Search</h1>") && bareSearch.html.includes('action="/search"'), `${bareSearch.status}`);

  const sorted = await get(`/search?${searchQ}&sort=price-asc`);
  check("search honours the sort param", sorted.status === 200 && sorted.html.includes(FIXTURE_NAME), `${sorted.status}`);

  const shopPage2 = await get("/shop");
  check("the /shop page keeps its inline shop search form", shopPage2.html.includes('action="/shop"'), "inline shop search moved");

  // Wishlist: guests are refused by the action…
  const guestToggle = await callAction("/shop", ids.toggleWishlist, [fixtureProduct.id]);
  check(
    "guest heart attempt → signed-in refusal",
    guestToggle.json?.success === false && guestToggle.json?.error === "You must be signed in.",
    JSON.stringify(guestToggle.json)
  );

  // …while a signed-in user toggles a real row.
  const addRes = await callAction("/shop", ids.toggleWishlist, [fixtureProduct.id], loginJar);
  check("signed-in heart → added", addRes.json?.success === true && addRes.json?.added === true, JSON.stringify(addRes.json));
  const wishRow = await db.wishlistItem.findFirst({ where: { userId: customer.id, productId: fixtureProduct.id } });
  check("wishlist row lands in the database", wishRow !== null, String(wishRow?.id ?? "null"));

  const anonWish = await get("/wishlist");
  check(
    "anonymous /wishlist bounces to login with a callback",
    anonWish.status >= 300 && anonWish.status < 400 && (anonWish.location ?? "").startsWith("/login") && (anonWish.location ?? "").includes("callbackUrl=%2Fwishlist"),
    `${anonWish.status} ${anonWish.location}`
  );

  const wishPage = await get("/wishlist", loginJar);
  check("signed-in /wishlist renders the saved product", wishPage.status === 200 && wishPage.html.includes(FIXTURE_NAME), `${wishPage.status}`);
  check(
    "the saved card shows a filled (pressed) heart",
    wishPage.html.includes('aria-pressed="true"'),
    "aria-pressed=true missing"
  );
  check("wishlist shows its saved-count line", wishPage.html.includes("1 saved item"), (wishPage.html.match(/\d+ saved items?/) ?? ["no count"])[0]);

  const otherWish = await get("/wishlist", adminLogin.jar);
  check(
    "another account never sees the saved product",
    otherWish.status === 200 && !otherWish.html.includes(FIXTURE_NAME) && otherWish.html.includes("No saved items yet"),
    `${otherWish.status}`
  );

  const removeRes = await callAction("/shop", ids.toggleWishlist, [fixtureProduct.id], loginJar);
  check("second heart click removes the row", removeRes.json?.success === true && removeRes.json?.added === false, JSON.stringify(removeRes.json));
  const goneRow = await db.wishlistItem.findFirst({ where: { userId: customer.id, productId: fixtureProduct.id } });
  check("wishlist row is gone", goneRow === null, String(goneRow?.id ?? "still present"));

  const emptyWish = await get("/wishlist", loginJar);
  check(
    "the emptied wishlist shows its empty state",
    emptyWish.status === 200 && emptyWish.html.includes("No saved items yet") && !emptyWish.html.includes(FIXTURE_NAME),
    `${emptyWish.status}`
  );
}

// ── 20. Phase 16: design & polish — applied spec ───────────────────────────
{
  const home = await get("/");
  // The h1 ships as two spans (mockup line break) — normalize tags and
  // whitespace so the contiguous-copy locks apply to the rendered text.
  const homeText = home.html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
  check(
    "homepage hero carries the locked headline",
    home.status === 200 && homeText.includes("Handmade Pieces, Made to Be Cherished."),
    `${home.status}`
  );
  check(
    "homepage hero subtext is the spec line",
    homeText.includes("From lasting blooms to little keepsakes, every piece is made with care.")
  );
  check("the old hero copy is gone", !home.html.includes("one stitch at a time"));
  check(
    "homepage renders exactly one h1",
    (home.html.match(/<h1/g) ?? []).length === 1,
    String((home.html.match(/<h1/g) ?? []).length)
  );
  const htmlNoScripts = home.html.replace(/<script[\s\S]*?<\/script>/g, "");
  const shopAnchors = [...htmlNoScripts.matchAll(/<a\s[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
    .filter((text) => text === "Shop Handmade");
  check("single hero CTA text (hero + closing only)", shopAnchors.length === 2, String(shopAnchors.length));
  check("featured section uses the locked heading", home.html.includes("FIND SOMETHING TO CHERISH"));
  check("gallery collage section ships", home.html.includes('class="girah-gallery"'));
  check(
    "gallery locked copy ships",
    home.html.includes("A little world,") && home.html.includes("Every stitch tells a story")
  );
  check("gallery CTA points at the catalog", home.html.includes("Explore the collection"));
  check("gallery images are served", (await get("/gallery/sunflower.webp")).status === 200);
  check("gallery vine cut-outs resolve", (await get("/gallery/vine1.webp")).status === 200);
  check(
    "closing CTA eyebrow + statement ship",
    home.html.includes("A SMALL GIRAH MOMENT") && home.html.includes("Handmade things,")
  );
  check(
    "the old sage CTA band and category chips are gone",
    !home.html.includes("Start shopping") && !home.html.includes("Shop by category")
  );
  check("trust strip is present", home.html.includes("Why shop with Girah"));
  check("immersive bouquet ships its scroll-driven hook", home.html.includes("--bouquet-scale"));
  check("immersive message copy ships", home.html.includes("with care in every stitch."));
  check("Instagram showcase stays gated without real assets", !home.html.includes("FOLLOW GIRAH"));
  check(
    "home ships WebSite/Organization structured data",
    home.html.includes("application/ld+json") && home.html.includes('"@type":"WebSite"'),
    (home.html.match(/"@type":"\w+"/g) ?? ["no ld+json"])[0]
  );
  check("footer carries the brand sentence", home.html.includes("Handmade pieces, made to be cherished."));
  check(
    "footer links the six built content pages, never /faq",
    home.html.includes('href="/about"') &&
      home.html.includes('href="/contact"') &&
      home.html.includes('href="/privacy"') &&
      home.html.includes('href="/terms"') &&
      !home.html.includes('href="/faq"')
  );
  check("header links Home", home.html.includes(">Home</a>"));
  check("floral cutouts are served through the app", home.html.includes("florals"));
  check("floral file itself resolves 200", (await get("/florals/sunflower.png")).status === 200);

  const product = await get(`/product/${fixtureProduct.slug}`);
  check(
    "product page renders an open Description accordion",
    product.status === 200 && product.html.includes('aria-expanded="true"'),
    `${product.status}`
  );
  check("product accordions ship Description + Details", product.html.includes("Description") && product.html.includes("Details"));
  check("free shipping estimate sits near the buy action", product.html.includes("Free shipping on all orders."));
  check("variation buttons expose aria-pressed", product.html.includes('aria-pressed="false"'));
  check(
    "product JSON-LD ships with offer data",
    product.html.includes('"@type":"Product"') && product.html.includes("priceCurrency")
  );

  const shop = await get("/shop");
  check("shop intro matches the spec", shop.html.includes("Discover handmade pieces, made with care."));
  check("shop ships BreadcrumbList structured data", shop.html.includes('"@type":"BreadcrumbList"'));

  const loginPage = await get("/login");
  check(
    "login keeps the spec guest escape hatch",
    loginPage.status === 200 && loginPage.html.includes("Continue as Guest"),
    `${loginPage.status}`
  );

  const account = await get("/account", loginJar);
  check(
    "account dashboard ships the editorial blocks incl. wishlist",
    account.status === 200 &&
      account.html.includes('href="/account/orders"') &&
      account.html.includes('href="/account/addresses"') &&
      account.html.includes('href="/wishlist"'),
    `${account.status}`
  );
}

// ── 21. Phase 17: launch readiness — pagination, SEO, content pages, headers ─
const paginatedProducts = [];
{
  // 13 products so the e2e-page search matches paginate across 2 pages
  // (PAGE_SIZE is 12) while the rest of the catalog stays untouched.
  for (let i = 1; i <= 13; i++) {
    const n = String(i).padStart(2, "0");
    paginatedProducts.push(
      await db.product.create({
        data: {
          name: `E2E Page ${n} ${TS}`,
          slug: `e2e-page-${n}-${TS}`,
          description: "Phase 17 pagination fixture.",
          categoryId: category.id,
          variations: { create: [{ name: "Standard", price: 100000, stock: 3, isEnabled: true }] },
        },
        include: { variations: true },
      })
    );
  }

  // --- pagination: /shop -------------------------------------------------
  const shopP1 = await get("/shop?page=1");
  check(
    "shop page 1 renders with a Next link",
    shopP1.status === 200 && shopP1.html.includes('rel="next"'),
    `${shopP1.status}`
  );
  const shopP2 = await get("/shop?page=2");
  check(
    "shop page 2 renders with a Prev link and content",
    shopP2.status === 200 &&
      shopP2.html.includes('rel="prev"') &&
      shopP2.html.includes('aria-label="Pagination"') &&
      !shopP2.html.includes("Nothing here"),
    `${shopP2.status}`
  );
  const shopClamped = await get("/shop?page=999");
  check(
    "shop ?page=999 clamps to a real page instead of an empty screen",
    shopClamped.status === 200 &&
      !shopClamped.html.includes("Nothing here") &&
      shopClamped.html.includes('aria-current="page"'),
    `${shopClamped.status}`
  );
  const categoryHrefs = [...shopP2.html.matchAll(/href="(\/shop\?category=[^"]*)"/g)].map((m) => m[1]);
  check(
    "category tab links reset ?page (no stale pagination)",
    categoryHrefs.length > 0 && categoryHrefs.every((href) => !href.includes("page=")),
    JSON.stringify(categoryHrefs.slice(0, 3))
  );

  // --- pagination: /search ----------------------------------------------
  const searchQuery = encodeURIComponent("E2E Page");
  const searchP2 = await get(`/search?search=${searchQuery}&page=2`);
  check(
    "search page 2 keeps the TOTAL match count in the label",
    searchP2.status === 200 && searchP2.html.includes("13 products matching &quot;E2E Page&quot;"),
    `${searchP2.status} ${searchP2.html.match(/\d+ products matching[^<]*/)?.[0] ?? "no label"}`
  );
  check(
    "search page 2 paginates",
    searchP2.html.includes('aria-label="Pagination"') && searchP2.html.includes('rel="prev"')
  );
  const searchClamped = await get(`/search?search=${searchQuery}&page=999`);
  check(
    "search ?page=999 clamps (no empty state)",
    searchClamped.status === 200 && !searchClamped.html.includes("No matches"),
    `${searchClamped.status}`
  );
  const noMatch = await get(`/search?search=${encodeURIComponent("zzz-no-such-thing-zzz")}`);
  check(
    "empty search still shows the empty state without pagination",
    noMatch.status === 200 &&
      noMatch.html.includes("No matches") &&
      !noMatch.html.includes('aria-label="Pagination"')
  );

  // --- six content pages + footer ----------------------------------------
  const contentSpecs = [
    ["about", "About"],
    ["contact", "Contact"],
    ["shipping", "Shipping &amp; Delivery"],
    ["returns", "Returns &amp; Refunds"],
    ["privacy", "Privacy Policy"],
    ["terms", "Terms of Service"],
  ];
  const contentHtml = {};
  for (const [slug, title] of contentSpecs) {
    const res = await get(`/${slug}`);
    contentHtml[slug] = res.html;
    check(
      `/${slug} renders 200 with the templated title`,
      res.status === 200 && res.html.includes(`<title>${title} · Girah</title>`),
      `${res.status}`
    );
  }
  const home21 = await get("/");
  check(
    "home footer links every content page",
    contentSpecs.every(([slug]) => home21.html.includes(`href="/${slug}"`)) &&
      !home21.html.includes('href="/faq"')
  );
  check(
    "legal skeletons carry visible [placeholder] markers",
    ["returns", "privacy", "terms"].every((slug) => contentHtml[slug].includes("placeholder"))
  );
  check(
    "contact only lists configured channels",
    contentHtml.contact.includes("NEXT_PUBLIC_CONTACT_EMAIL") ||
      contentHtml.contact.includes("mailto:") ||
      contentHtml.contact.includes("placeholder")
  );

  // --- robots + sitemap ---------------------------------------------------
  const robots = await get("/robots.txt");
  check(
    "robots.txt ships with private routes blocked and a sitemap pointer",
    robots.status === 200 &&
      robots.html.includes("Disallow: /admin/") &&
      robots.html.includes("Disallow: /checkout") &&
      robots.html.includes("Sitemap:"),
    `${robots.status}`
  );
  const sitemap = await get("/sitemap.xml");
  check(
    "sitemap lists shop, live products, and content pages",
    sitemap.status === 200 &&
      sitemap.html.includes("/shop") &&
      sitemap.html.includes(`/product/${fixtureProduct.slug}`) &&
      sitemap.html.includes("/terms") &&
      !sitemap.html.includes("/search"),
    `${sitemap.status}`
  );

  // --- noindex on thin/session pages --------------------------------------
  const searchThin = await get("/search?search=sun");
  check("search results are noindex", searchThin.html.includes('name="robots" content="noindex'));
  const cartPage = await get("/cart");
  check("cart is noindex", cartPage.html.includes('name="robots" content="noindex'));

  // Checkout: needs a filled cart (customer session) — the Safepay radio
  // renders because the environment ships credentials.
  const addToCheckoutCart = await callAction(
    "/cart",
    ids.addToCart,
    [paginatedProducts[0].variations[0].id, 1],
    loginJar
  );
  check(
    "seed item added for the checkout render",
    addToCheckoutCart.json?.success === true,
    JSON.stringify(addToCheckoutCart.json)
  );
  const checkoutPage = await get("/checkout", loginJar);
  check(
    "checkout renders with the online-payment option (Safepay configured)",
    checkoutPage.status === 200 &&
      checkoutPage.html.includes("Online Payment (Cards, JazzCash, EasyPaisa)"),
    `${checkoutPage.status}`
  );
  check(
    "checkout is noindex",
    checkoutPage.html.includes('name="robots" content="noindex'),
    checkoutPage.html.match(/name="robots"[^>]* /)?.[0] ?? "NO_META"
  );

  // --- per-product OG + root metadata -------------------------------------
  const ogProduct = await get(`/product/${fixtureProduct.slug}`);
  check(
    "product page ships og:title with the product name",
    ogProduct.html.includes(`property="og:title" content="${FIXTURE_NAME}"`)
  );
  check("home ships og:image (brand asset)", home21.html.includes('property="og:image"'));
  check("shop uses the title template", (await get("/shop")).html.includes("<title>Shop · Girah</title>"));

  // --- security headers + the /api/auth carve-out --------------------------
  const headerHome = await get("/");
  const csp = headerHome.res.headers.get("content-security-policy") ?? "";
  check(
    "CSP ships on HTML responses (same-origin, framed denied)",
    csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'"),
    csp.slice(0, 90)
  );
  check(
    "nosniff + frame denial ship",
    headerHome.res.headers.get("x-content-type-options") === "nosniff" &&
      headerHome.res.headers.get("x-frame-options") === "DENY"
  );
  check(
    "HSTS ships on the production build",
    Boolean(headerHome.res.headers.get("strict-transport-security"))
  );
  const csrfProbe = await safeFetch(`${BASE}/api/auth/csrf`, { headers: {} });
  const csrfCookies = csrfProbe.headers
    .getSetCookie()
    .filter((sc) => sc.startsWith("authjs.csrf-token="));
  check(
    "csrf endpoint returns exactly one csrf cookie (middleware excluded)",
    csrfCookies.length === 1,
    String(csrfCookies.length)
  );
}

// ── 22. coverage gaps: confirmation/profile/customer pages + wrapped actions ─
const p22Orders = [];
{
  for (const name of ["removeCartItem", "adjustStock", "startSafepayRetry"]) {
    check(`action id resolved: ${name}`, Boolean(ids[name]), "missing from server-reference-manifest.json");
  }

  // --- /account/profile (page was never fetched) ---------------------------
  const anonProfile = await get("/account/profile");
  check(
    "anon /account/profile bounces to login with callbackUrl",
    [302, 307].includes(anonProfile.status) &&
      (anonProfile.location ?? "").includes("/login?callbackUrl=%2Faccount%2Fprofile"),
    `${anonProfile.status} ${anonProfile.location}`
  );
  const profilePage = await get("/account/profile", loginJar);
  check(
    "/account/profile renders the profile form and the Security section",
    profilePage.status === 200 &&
      profilePage.html.includes('name="email"') &&
      profilePage.html.includes('name="currentPassword"') &&
      profilePage.html.includes('name="newPassword"') &&
      profilePage.html.includes('name="confirmNewPassword"') &&
      profilePage.html.includes("Security"),
    `${profilePage.status}`
  );
  check(
    "AccountNav marks Profile as current on /account/profile",
    /href="\/account\/profile"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/account\/profile"/.test(
      profilePage.html
    ),
    "aria-current missing from the Profile tab"
  );

  // --- /admin/customers/[id] (page was never fetched) ----------------------
  const custPath = `/admin/customers/${customer.id}`;
  const anonCust = await get(custPath);
  check(
    "anon customer detail bounces to login with callbackUrl",
    [302, 307].includes(anonCust.status) &&
      (anonCust.location ?? "").includes(`/login?callbackUrl=%2Fadmin%2Fcustomers%2F${customer.id}`),
    `${anonCust.status} ${anonCust.location}`
  );
  const custAsCustomer = await get(custPath, loginJar);
  const custLoc = (custAsCustomer.location ?? "").replace(BASE, "");
  check(
    "signed-in customer redirects home from the admin detail page",
    [302, 307].includes(custAsCustomer.status) && custLoc === "/",
    `${custAsCustomer.status} ${custAsCustomer.location}`
  );
  const adminCust = await get(custPath, adminLogin.jar);
  check(
    "admin customer detail renders identity + order history",
    adminCust.status === 200 &&
      adminCust.html.includes(customer.email) &&
      adminCust.html.includes("Order History"),
    `${adminCust.status}`
  );
  check(
    "customer detail never leaks the bcrypt password hash",
    !adminCust.html.includes("$2b$") && !adminCust.html.includes("passwordHash"),
    "hash material rendered into the page or flight payload"
  );
  const missingCust = await get(`/admin/customers/no-such-customer-${TS}`, adminLogin.jar);
  check(
    "unknown customer id renders our 404 view",
    missingCust.html.includes("Page not found"),
    `status ${missingCust.status}`
  );

  // --- /order/[id]/confirmation (page was never fetched) -------------------
  const confGuest = await get(`/order/${probeOrder.id}/confirmation`);
  check(
    "guest confirmation renders the order number and COD label",
    confGuest.status === 200 &&
      confGuest.html.includes(probeOrder.orderNumber) &&
      confGuest.html.includes("Cash on Delivery") &&
      confGuest.html.includes("Order Confirmed"),
    `${confGuest.status} orderNo=${confGuest.html.includes(probeOrder.orderNumber)} cod=${confGuest.html.includes("Cash on Delivery")}`
  );
  const confErr = await get(`/order/${probeOrder.id}/confirmation?payment_error=1`);
  check(
    "?payment_error=1 renders the retry-error notice",
    confErr.status === 200 &&
      confErr.html.includes("start the payment") &&
      confErr.html.includes("please try again"),
    `${confErr.status}`
  );
  check(
    "the default confirmation shows NO payment-error notice",
    !confGuest.html.includes("start the payment"),
    "notice leaked into the clean confirmation"
  );

  const safepayPending = await db.order.create({
    data: {
      orderNumber: `GIR-P22S${TS.toString(16).slice(-10)}`,
      customerName: "E2E P22",
      customerEmail: "e2e-p22@example.com",
      customerPhone: "03001234567",
      shippingAddress: "1 E2E Lane",
      shippingCity: "Karachi",
      subtotal: 180000,
      total: 180000,
      userId: customer.id,
      paymentMethod: "SAFEPAY",
      paymentStatus: "PENDING",
      orderStatus: "CONFIRMED",
    },
  });
  p22Orders.push(safepayPending.id);
  const payNowPage = await get(`/order/${safepayPending.id}/confirmation`, loginJar);
  check(
    "owner sees the pending-payment page with the Pay Now CTA",
    payNowPage.status === 200 &&
      payNowPage.html.includes("Payment Pending") &&
      payNowPage.html.includes("Pay Now"),
    `${payNowPage.status}`
  );
  const strangerConf = await get(`/order/${safepayPending.id}/confirmation`, adminLogin.jar);
  check(
    "stranger GET confirmation renders our 404 view",
    strangerConf.html.includes("Page not found"),
    `status ${strangerConf.status}`
  );
  const anonConf = await get(`/order/${safepayPending.id}/confirmation`);
  check(
    "anon GET account confirmation renders our 404 view",
    anonConf.html.includes("Page not found"),
    `status ${anonConf.status}`
  );
  const missingConf = await get(`/order/no-such-order-${TS}/confirmation`);
  check(
    "unknown confirmation id renders our 404 view",
    missingConf.html.includes("Page not found"),
    `status ${missingConf.status}`
  );

  // --- removeCartItem over the wire (anti-oracle + success) ----------------
  await seedUserCart(customer.id, [{ variationId: V_SMALL, quantity: 2 }]);
  const cartLine = await db.cartItem.findFirst({ where: { cart: { userId: customer.id } } });
  check("cart line seeded for the removal probe", Boolean(cartLine), "no CartItem row");
  if (cartLine) {
    const REFUSAL = "Item not found in your cart.";
    const anonRemove = await callAction("/cart", ids.removeCartItem, [cartLine.id], null);
    check(
      "anonymous removeCartItem refuses a foreign line",
      anonRemove.json?.success === false && anonRemove.json?.error === REFUSAL,
      JSON.stringify(anonRemove.json)
    );
    const strangerRemove = await callAction("/cart", ids.removeCartItem, [cartLine.id], adminLogin.jar);
    check(
      "stranger removeCartItem gets the IDENTICAL refusal (anti-oracle)",
      strangerRemove.json?.success === false && strangerRemove.json?.error === REFUSAL,
      JSON.stringify(strangerRemove.json)
    );
    check(
      "refused removals leave the line intact",
      Boolean(await db.cartItem.findUnique({ where: { id: cartLine.id } }))
    );
    const ownerRemove = await callAction("/cart", ids.removeCartItem, [cartLine.id], loginJar);
    check(
      "owner removeCartItem deletes the line",
      ownerRemove.json?.success === true &&
        (await db.cartItem.findUnique({ where: { id: cartLine.id } })) === null,
      JSON.stringify(ownerRemove.json)
    );
  }

  // --- adjustStock over the wire (proxy gates + admin audit) --------------
  const anonAdjust = await callAction("/admin/variations", ids.adjustStock, [V_SINGLE, { adjustment: 1, reason: "anon" }], null);
  check(
    "anonymous adjustStock POST is bounced to /login by the proxy",
    anonAdjust.status >= 300 && anonAdjust.status < 400 && (anonAdjust.location ?? "").includes("/login"),
    `${anonAdjust.status} ${anonAdjust.location}`
  );
  const customerAdjust = await callAction("/admin/variations", ids.adjustStock, [V_SINGLE, { adjustment: 1, reason: "customer" }], loginJar);
  const customerAdjustLoc = (customerAdjust.location ?? "").replace(BASE, "");
  check(
    "customer adjustStock POST redirects home (never reaches the action)",
    customerAdjust.status >= 300 && customerAdjust.status < 400 && customerAdjustLoc === "/",
    `${customerAdjust.status} ${customerAdjust.location}`
  );

  const p22Admin = await db.user.findUnique({ where: { email: ADMIN.email } });
  const stockBefore22 = (await db.productVariation.findUniqueOrThrow({ where: { id: V_SINGLE } })).stock;
  const adjustReason = `E2E adjust ${TS}`;
  const okAdjust = await callAction("/admin/variations", ids.adjustStock, [V_SINGLE, { adjustment: 2, reason: adjustReason }], adminLogin.jar);
  const stockAfter22 = (await db.productVariation.findUniqueOrThrow({ where: { id: V_SINGLE } })).stock;
  const adjustRow = await db.stockAdjustment.findFirst({ where: { reason: adjustReason } });
  check(
    "admin adjustStock applies the delta over the wire",
    okAdjust.json?.success === true && stockAfter22 === stockBefore22 + 2,
    `success=${okAdjust.json?.success} ${stockBefore22} → ${stockAfter22}`
  );
  check(
    "adjustStock writes the audit row attributed to the admin",
    adjustRow?.adjustment === 2 &&
      adjustRow?.previousStock === stockBefore22 &&
      adjustRow?.newStock === stockAfter22 &&
      adjustRow?.adminId === p22Admin?.id,
    JSON.stringify(adjustRow)
  );
  const badAdjust = await callAction("/admin/variations", ids.adjustStock, [V_SINGLE, { adjustment: 1, reason: "   " }], adminLogin.jar);
  check(
    "adjustStock refuses an empty reason with a field error",
    badAdjust.json?.success === false && badAdjust.json?.fieldErrors?.reason === "A reason is required",
    JSON.stringify(badAdjust.json)
  );
  const negAdjust = await callAction("/admin/variations", ids.adjustStock, [V_SINGLE, { adjustment: -99999, reason: `E2E negative ${TS}` }], adminLogin.jar);
  check(
    "adjustStock refuses an adjustment past zero",
    negAdjust.json?.success === false &&
      negAdjust.json?.error === "Adjustment would result in negative stock.",
    JSON.stringify(negAdjust.json)
  );
  check(
    "refused adjustments leave stock untouched",
    (await db.productVariation.findUniqueOrThrow({ where: { id: V_SINGLE } })).stock === stockAfter22,
    "stock moved after a refusal"
  );

  // --- startSafepayRetry: deterministic pre-API failures ONLY -------------
  // Every branch below errors out before createSafepayCheckoutUrl, so no run
  // ever depends on live Safepay credentials. (The success path is covered by
  // tests/integration/retry-payment.test.ts with a mocked SDK.)
  const codRetry = await callAction(`/order/${probeOrder.id}/confirmation`, ids.startSafepayRetry, [probeOrder.id], null);
  const codRetryTarget = codRetry.actionRedirect ?? codRetry.location ?? "";
  check(
    "retry on a COD order redirects to ?payment_error=1",
    codRetry.status === 200 &&
      codRetryTarget.includes(`/order/${probeOrder.id}/confirmation?payment_error=1`),
    JSON.stringify({ status: codRetry.status, actionRedirect: codRetry.actionRedirect, location: codRetry.location })
  );

  const paidSafepay = await db.order.create({
    data: {
      orderNumber: `GIR-P22P${TS.toString(16).slice(-10)}`,
      customerName: "E2E P22 Paid",
      customerEmail: "e2e-p22-paid@example.com",
      customerPhone: "03001234567",
      shippingAddress: "1 E2E Lane",
      shippingCity: "Karachi",
      subtotal: 180000,
      total: 180000,
      userId: customer.id,
      paymentMethod: "SAFEPAY",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
    },
  });
  p22Orders.push(paidSafepay.id);
  const ownerPaidRetry = await callAction(`/order/${paidSafepay.id}/confirmation`, ids.startSafepayRetry, [paidSafepay.id], loginJar);
  const ownerPaidTarget = ownerPaidRetry.actionRedirect ?? ownerPaidRetry.location ?? "";
  check(
    "retry on an already-PAID order redirects to ?payment_error=1 (no API call)",
    ownerPaidRetry.status === 200 &&
      ownerPaidTarget.includes(`/order/${paidSafepay.id}/confirmation?payment_error=1`),
    JSON.stringify({ status: ownerPaidRetry.status, actionRedirect: ownerPaidRetry.actionRedirect })
  );
  const strangerPaidRetry = await callAction(`/order/${paidSafepay.id}/confirmation`, ids.startSafepayRetry, [paidSafepay.id], adminLogin.jar);
  const strangerPaidTarget = strangerPaidRetry.actionRedirect ?? strangerPaidRetry.location ?? "";
  check(
    "a stranger's retry gets the IDENTICAL redirect (anti-oracle)",
    strangerPaidRetry.status === 200 &&
      strangerPaidTarget.includes(`/order/${paidSafepay.id}/confirmation?payment_error=1`),
    JSON.stringify({ status: strangerPaidRetry.status, actionRedirect: strangerPaidRetry.actionRedirect })
  );
  const anonPaidRetry = await callAction(`/order/${paidSafepay.id}/confirmation`, ids.startSafepayRetry, [paidSafepay.id], null);
  const anonPaidTarget = anonPaidRetry.actionRedirect ?? anonPaidRetry.location ?? "";
  check(
    "anonymous retry on an account order redirects to ?payment_error=1",
    anonPaidRetry.status === 200 &&
      anonPaidTarget.includes(`/order/${paidSafepay.id}/confirmation?payment_error=1`),
    JSON.stringify({ status: anonPaidRetry.status, actionRedirect: anonPaidRetry.actionRedirect })
  );
}

// ── cleanup ─────────────────────────────────────────────────────────────────
await wipeUserCart(customer.id);
await db.cart.deleteMany({ where: { guestId: { startsWith: "e2e-guest-" } } });
if (newUser) await db.user.delete({ where: { id: newUser.id } }); // cascades their cart
await db.order.delete({ where: { id: probeOrder.id } }).catch(() => {});
if (reviewOrder) await db.order.delete({ where: { id: reviewOrder.id } }).catch(() => {});
for (const orderId of p12Orders) await db.order.delete({ where: { id: orderId } }).catch(() => {});
for (const orderId of p13Orders) await db.order.delete({ where: { id: orderId } }).catch(() => {});
for (const orderId of p22Orders) await db.order.delete({ where: { id: orderId } }).catch(() => {});
await db.stockAdjustment.deleteMany({ where: { reason: { contains: "E2E P13 stock" } } });
if (p11Order) await db.order.delete({ where: { id: p11Order.id } }).catch(() => {});
if (p11Product) await db.product.delete({ where: { id: p11Product.id } }).catch(() => {});
for (const product of [...Object.values(floatProducts), unavailableProduct, fixtureProduct]) {
  await db.product.delete({ where: { id: product.id } }).catch(() => {});
}
for (const product of paginatedProducts) {
  await db.product.delete({ where: { id: product.id } }).catch(() => {});
}
// On a database this script bootstrapped, drop the category once it is empty.
if (category.slug === "e2e-fixtures") {
  const remaining = await db.product.count({ where: { categoryId: category.id } });
  if (remaining === 0) await db.category.delete({ where: { id: category.id } }).catch(() => {});
}
await db.$disconnect();

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log(`\n${passed}/${results.length} checks passed`);
if (failed.length) {
  console.log("Failures:");
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `  << ${f.detail}` : ""}`);
}
process.exit(failed.length ? 1 : 0);
