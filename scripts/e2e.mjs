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
const bcrypt = require("bcryptjs");

const db = new PrismaClient();

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const TS = Date.now();

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
    setCookies,
    json: parseActionPayload(text),
    text,
  };
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
    "header ships a search form posting to /shop",
    home.html.includes('action="/shop"') && home.html.includes('name="search"')
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

// ── cleanup ─────────────────────────────────────────────────────────────────
await wipeUserCart(customer.id);
await db.cart.deleteMany({ where: { guestId: { startsWith: "e2e-guest-" } } });
if (newUser) await db.user.delete({ where: { id: newUser.id } }); // cascades their cart
await db.order.delete({ where: { id: probeOrder.id } }).catch(() => {});
if (reviewOrder) await db.order.delete({ where: { id: reviewOrder.id } }).catch(() => {});
for (const product of [...Object.values(floatProducts), unavailableProduct, fixtureProduct]) {
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
