// Smoke suite — every sensitive page must render 200 with no application error.
// Self-contained: creates its own test accounts and, on an unseeded database,
// its own fixture variation, so it runs against any database.
// Usage: `npm run build && npm start &` then `npm run test:smoke`.
//   E2E_BASE_URL — override the server origin (default http://localhost:3100)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(join(ROOT, "package.json"));
require("dotenv").config({ path: join(ROOT, ".env") });

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const TS = Date.now();

const newJar = () => new Map();
const jarHeader = (jar) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function applySetCookies(jar, setCookies) {
  for (const sc of setCookies ?? []) {
    const [pair] = sc.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const expired = value === "" || /max-age=0/i.test(sc) || /expires=thu,\s+01 jan 1970/i.test(sc);
    if (expired) jar.delete(name);
    else jar.set(name, value);
  }
}

// channel: "customer" (storefront /login) or "executive" (the /executive/login
// door — the only channel that can mint an ADMIN session; owner spec).
async function apiLogin(email, password, channel = "customer") {
  const jar = newJar();
  const csrfRes = await fetch(BASE + "/api/auth/csrf", { headers: { Cookie: jarHeader(jar) } });
  applySetCookies(jar, csrfRes.headers.getSetCookie());
  const { csrfToken } = await csrfRes.json();
  const res = await fetch(BASE + "/api/auth/callback/credentials", {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
      Cookie: jarHeader(jar),
    },
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: "/", redirect: "false", channel }).toString(),
  });
  applySetCookies(jar, res.headers.getSetCookie());
  return jar;
}

const checks = [];
async function hit(label, path, jar) {
  const res = await fetch(BASE + path, { headers: jar ? { Cookie: jarHeader(jar) } : {}, redirect: "manual" });
  const html = await res.text();
  const ok = res.status === 200 && !/<h1[^>]*>Application error/i.test(html) && !/Unhandled Runtime Error/.test(html);
  checks.push([label, ok, `${res.status} ${path}`]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (${res.status})`);
  return html;
}

const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");
const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

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

const customerRow = await ensureUser({
  email: "dev-customer@girah.test",
  password: "DevCustomer123!",
  role: "CUSTOMER",
});
await ensureUser({ email: "dev-admin@girah.test", password: "DevAdmin123!", role: "ADMIN" });

// A filled cart needs some enabled variation — seed data on a dev
// database, our own fixture on a fresh one. (Stock no longer exists.)
let variation = await db.productVariation.findFirst({
  where: { isEnabled: true },
  select: { id: true },
});
let fixture = null;
let fixtureCategory = null;
if (!variation) {
  const category =
    (await db.category.findFirst()) ??
    (await db.category.create({ data: { name: "Smoke Fixtures", slug: "smoke-fixtures" } }));
  if (category.slug === "smoke-fixtures") fixtureCategory = category.id;
  fixture = await db.product.create({
    data: {
      name: `Smoke Fixture ${TS}`,
      slug: `smoke-fixture-${TS}`,
      description: "Smoke-suite cart fixture.",
      categoryId: category.id,
      variations: { create: [{ name: "Standard", price: 100000, isEnabled: true }] },
    },
    include: { variations: true },
  });
  variation = { id: fixture.variations[0].id };
}

const admin = await apiLogin("dev-admin@girah.test", "DevAdmin123!", "executive");
const customer = await apiLogin("dev-customer@girah.test", "DevCustomer123!");
// Owner spec (single-owner store): the channel gate, over raw HTTP.
{
  const adminViaStorefront = await apiLogin("dev-admin@girah.test", "DevAdmin123!");
  const adminViaStorefrontOk = !adminViaStorefront.has("authjs.session-token");
  checks.push(["channel gate: admin creds via storefront /login → refused", adminViaStorefrontOk, adminViaStorefrontOk ? "no session cookie" : "session cookie minted!"]);
  console.log(`${adminViaStorefrontOk ? "PASS" : "FAIL"}  channel gate: admin creds via storefront /login → refused`);
  const customerViaDoor = await apiLogin("dev-customer@girah.test", "DevCustomer123!", "executive");
  const customerViaDoorOk = !customerViaDoor.has("authjs.session-token");
  checks.push(["channel gate: customer creds via executive door → refused", customerViaDoorOk, customerViaDoorOk ? "no session cookie" : "session cookie minted!"]);
  console.log(`${customerViaDoorOk ? "PASS" : "FAIL"}  channel gate: customer creds via executive door → refused`);
}

await hit("public / renders (homepage)", "/");
await hit("public /login renders", "/login");
await hit("public /register renders", "/register");
// Phase 14: forgot/reset pages.
await hit("public /search renders", "/search");
await hit("public /forgot-password renders", "/forgot-password");
await hit("public /reset-password renders (missing token → invalid message)", "/reset-password");
await hit("admin /admin renders (dashboard)", "/admin", admin);
await hit("admin /admin/orders renders", "/admin/orders", admin);
await hit("admin /admin/catalog renders (merged products + categories)", "/admin/catalog", admin);
await hit("admin /admin/products/new renders", "/admin/products/new", admin);
const detailProduct = fixture ?? (await db.product.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }));
if (detailProduct) {
  await hit("admin /admin/products/[id] renders", `/admin/products/${detailProduct.id}`, admin);
} else {
  checks.push(["admin /admin/products/[id] renders", false, "no product available"]);
}
await hit("admin /admin/customers renders", "/admin/customers", admin);
await hit("admin /admin/reviews renders", "/admin/reviews", admin);
await hit("customer /account renders", "/account", customer);
await hit("customer /account/addresses renders", "/account/addresses", customer);
// Phase 15: wishlist is proxy-gated, so it only renders for a signed-in user.
await hit("customer /wishlist renders", "/wishlist", customer);

let cart = await db.cart.findUnique({ where: { userId: customerRow.id }, include: { items: true } });
const seededLine = cart?.items?.[0] ?? null;
if (!seededLine) {
  await db.cart.upsert({
    where: { userId: customerRow.id },
    create: { userId: customerRow.id, items: { create: { variationId: variation.id, quantity: 1 } } },
    update: {},
  });
}
await hit("customer /checkout renders with a filled cart", "/checkout", customer);

// Receipt page (Phase 12) needs an order OWNING user — reuse an existing one
// or seed ours, always cleaned up before the fixture variation is deleted.
let receiptOrder = await db.order.findFirst({ where: { userId: customerRow.id }, select: { id: true } });
let seededReceiptOrderId = null;
if (!receiptOrder) {
  const seeded = await db.order.create({
    data: {
      orderNumber: `GIR-SMOKE-${TS}`,
      userId: customerRow.id,
      customerName: "Dev Customer",
      customerEmail: "dev-customer@girah.test",
      customerPhone: "03000000000",
      shippingAddress: "Smoke Street 1",
      shippingCity: "Islamabad",
      subtotal: 100000,
      total: 100000,
      paymentMethod: "COD",
      items: {
        create: [{
          variationId: variation.id,
          productName: "Smoke Fixture Item",
          variationName: "Standard",
          unitPrice: 100000,
          quantity: 1,
          subtotal: 100000,
        }],
      },
    },
  });
  seededReceiptOrderId = seeded.id;
  receiptOrder = { id: seeded.id };
}
await hit("customer order receipt renders", `/account/orders/${receiptOrder.id}/receipt`, customer);
// Phase 13: admin order detail reuses the same order (any owned order works).
await hit("admin /admin/orders/[id] renders", `/admin/orders/${receiptOrder.id}`, admin);
if (seededReceiptOrderId) await db.order.delete({ where: { id: seededReceiptOrderId } }).catch(() => {});

if (!seededLine) await db.cartItem.deleteMany({ where: { cart: { userId: customerRow.id } } });
if (fixture) await db.product.delete({ where: { id: fixture.id } }).catch(() => {});
if (fixtureCategory) {
  const remaining = await db.product.count({ where: { categoryId: fixtureCategory } });
  if (remaining === 0) await db.category.delete({ where: { id: fixtureCategory } }).catch(() => {});
}
await db.$disconnect();

const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length - failed.length}/${checks.length} pages rendered`);
process.exit(failed.length ? 1 : 0);
