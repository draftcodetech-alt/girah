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

async function apiLogin(email, password) {
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
    body: new URLSearchParams({ email, password, csrfToken, callbackUrl: "/", redirect: "false" }).toString(),
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
const bcrypt = require("bcryptjs");
const db = new PrismaClient();

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

// A filled cart needs some enabled in-stock variation — seed data on a dev
// database, our own fixture on a fresh one.
let variation = await db.productVariation.findFirst({
  where: { isEnabled: true, stock: { gt: 1 } },
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
      variations: { create: [{ name: "Standard", price: 100000, stock: 5, isEnabled: true }] },
    },
    include: { variations: true },
  });
  variation = { id: fixture.variations[0].id };
}

const admin = await apiLogin("dev-admin@girah.test", "DevAdmin123!");
const customer = await apiLogin("dev-customer@girah.test", "DevCustomer123!");

await hit("public / renders (homepage)", "/");
await hit("public /login renders", "/login");
await hit("public /register renders", "/register");
await hit("admin /admin/orders renders", "/admin/orders", admin);
await hit("admin /admin/variations renders", "/admin/variations", admin);
await hit("admin /admin/products/new renders", "/admin/products/new", admin);
const detailProduct = fixture ?? (await db.product.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }));
if (detailProduct) {
  await hit("admin /admin/products/[id] renders", `/admin/products/${detailProduct.id}`, admin);
} else {
  checks.push(["admin /admin/products/[id] renders", false, "no product available"]);
}
await hit("admin /admin/categories renders", "/admin/categories", admin);
await hit("admin /admin/customers renders", "/admin/customers", admin);
await hit("admin /admin/reviews renders", "/admin/reviews", admin);
await hit("customer /account renders", "/account", customer);

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
