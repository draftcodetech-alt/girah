// Owner spec change (2026-10-24): Girah is a single-owner store with a clean
// slate. This script wipes ALL activity — orders (and their payment
// trackers), carts (including guest carts), wishlists, reviews, saved
// addresses, newsletter signups, password-reset tokens
// and leftover e2e/smoke fixture products — and leaves EXACTLY three
// accounts: one admin (permanent) and two customers.
//
// Usage:
//   node scripts/clean-dev-data.mjs --dry-run   # report only, changes nothing
//   node scripts/clean-dev-data.mjs             # perform the wipe
//
// Destructive by design. Dry-run first; the script re-prints its plan
// before executing.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(join(ROOT, "package.json"));
require("dotenv").config({ path: join(ROOT, ".env") });

const DRY = process.argv.includes("--dry-run");

const { PrismaClient } = require("@prisma/client");
const { PrismaNeon } = require("@prisma/adapter-neon");
const bcrypt = require("bcryptjs");
const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

// The permanent cast. The admin is created here on a fresh database; on a
// database that already has it, it is kept untouched.
const KEPT = [
  { email: "dev-admin@girah.test", name: "Dev Admin", role: "ADMIN", password: "DevAdmin123!" },
  { email: "dev-customer@girah.test", name: "Dev Customer", role: "CUSTOMER", password: "DevCustomer123!" },
  { email: "dev-customer2@girah.test", name: "Dev Customer Two", role: "CUSTOMER", password: "DevCustomer123!" },
];
const keptEmails = KEPT.map((k) => k.email);

async function report() {
  const [users, admins, orders, orderItems, carts, cartItems, wishlists, reviews, saved, news, tokens, fixtureProducts] =
    await Promise.all([
      db.user.findMany({ select: { email: true, role: true, isActive: true } }),
      db.user.count({ where: { role: "ADMIN" } }),
      db.order.count(),
      db.orderItem.count(),
      db.cart.count(),
      db.cartItem.count(),
      db.wishlistItem.count(),
      db.review.count(),
      db.savedShipping.count(),
      db.newsletterSubscriber.count(),
      db.passwordResetToken.count(),
      db.product.count({ where: { slug: { startsWith: "e2e-" } } }),
    ]);
  console.log("── current state ─────────────────────────────────");
  console.log(`users: ${users.length} (admins: ${admins})`);
  for (const u of users) console.log(`  - ${u.email} [${u.role}]${u.isActive ? "" : " (disabled)"}`);
  console.log(`orders: ${orders} (items: ${orderItems})`);
  console.log(`carts: ${carts} (items: ${cartItems})`);
  console.log(`wishlists: ${wishlists}  reviews: ${reviews}  saved addresses: ${saved}`);
  console.log(`newsletter signups: ${news}  reset tokens: ${tokens}`);
  console.log(`e2e fixture products: ${fixtureProducts}`);
  return { users, admins };
}

async function ensureKept() {
  for (const k of KEPT) {
    const existing = await db.user.findUnique({ where: { email: k.email } });
    if (existing) {
      if (existing.role !== k.role) {
        throw new Error(`${k.email} exists with role ${existing.role}, expected ${k.role} — refusing to guess.`);
      }
      console.log(`keep:  ${k.email} [${k.role}]`);
      continue;
    }
    await db.user.create({
      data: {
        email: k.email,
        name: k.name,
        role: k.role,
        isActive: true,
        passwordHash: bcrypt.hashSync(k.password, 10),
      },
    });
    console.log(`create: ${k.email} [${k.role}]`);
  }
}

async function wipe() {
  // Children first, in FK order. Everything below is "activity" — the
  // catalog (categories/products/variations/images) is deliberately kept.
  const steps = [
    ["password reset tokens", () => db.passwordResetToken.deleteMany({})],
    ["wishlist items", () => db.wishlistItem.deleteMany({})],
    ["reviews", () => db.review.deleteMany({})],
    ["saved shipping addresses", () => db.savedShipping.deleteMany({})],
    ["newsletter subscribers", () => db.newsletterSubscriber.deleteMany({})],
    ["cart items", () => db.cartItem.deleteMany({})],
    ["carts (incl. guest carts)", () => db.cart.deleteMany({})],
    ["order items", () => db.orderItem.deleteMany({})],
    ["orders (+ payment trackers)", () => db.order.deleteMany({})],
    ["users outside the kept three", () => db.user.deleteMany({ where: { email: { notIn: keptEmails } } })],
  ];
  for (const [label, run] of steps) {
    const { count } = await run();
    console.log(`wipe:  ${label}: ${count}`);
  }

  // e2e/smoke fixture products (children first).
  const fixtures = await db.product.findMany({
    where: { slug: { startsWith: "e2e-" } },
    select: { id: true, slug: true },
  });
  if (fixtures.length) {
    const ids = fixtures.map((f) => f.id);
    await db.productVariationImage.deleteMany({ where: { variation: { productId: { in: ids } } } });
    await db.productImage.deleteMany({ where: { productId: { in: ids } } });
    await db.productVariation.deleteMany({ where: { productId: { in: ids } } });
    const { count } = await db.product.deleteMany({ where: { id: { in: ids } } });
    console.log(`wipe:  e2e fixture products: ${count}`);
  }
}

async function verify() {
  const [users, admins, orders, carts, cartItems, wishlists, reviews, news, tokens] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.order.count(),
    db.cart.count(),
    db.cartItem.count(),
    db.wishlistItem.count(),
    db.review.count(),
    db.newsletterSubscriber.count(),
    db.passwordResetToken.count(),
  ]);
  const emails = (await db.user.findMany({ select: { email: true, role: true } })).sort((a, b) => a.email.localeCompare(b.email));
  console.log("── final state ──────────────────────────────────");
  for (const u of emails) console.log(`  - ${u.email} [${u.role}]`);
  const ok =
    users === 3 &&
    admins === 1 &&
    orders === 0 &&
    carts === 0 &&
    cartItems === 0 &&
    wishlists === 0 &&
    reviews === 0 &&
    news === 0 &&
    tokens === 0;
  if (!ok) throw new Error(`post-wipe invariant failed: ${JSON.stringify({ users, admins, orders, carts, cartItems, wishlists, reviews, news, tokens })}`);
  console.log(`verified: users=3 admins=1, all activity=0 ✓`);
}

const { users, admins } = await report();

if (DRY) {
  const wouldDelete = users.filter((u) => !keptEmails.includes(u.email));
  console.log("── dry run: nothing changed ─────────────────────");
  console.log(`would delete ${wouldDelete.length} user(s): ${wouldDelete.map((u) => u.email).join(", ") || "—"}`);
  console.log(`would end with exactly 3 accounts (1 admin${admins === 1 && users.some((u) => u.email === "dev-admin@girah.test") ? ", admin already present" : ", admin to create"})`);
} else {
  console.log("── executing wipe (no --dry-run) ─────────────────");
  await wipe();
  await ensureKept();
  await verify();
}

await db.$disconnect();
