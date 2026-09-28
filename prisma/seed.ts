import { PrismaClient, Role } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

// engineType = "client" (Phase 17 worker budget) needs a driver adapter —
// same Neon adapter the app and test suites use.
const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

// NOTE: TEST ACCOUNTS BELOW ARE LOCAL DEVELOPMENT ONLY.
// Never reuse these credentials anywhere real; never run this seed against production.

// Phase 17: production guard. The seed is idempotent (all upserts), but the
// dev fixture accounts (DevAdmin123!…) must never exist on a live site. We
// treat the environment as production-looking when NODE_ENV says so OR
// NEXT_PUBLIC_APP_URL is a non-local https origin; only an explicit
// ALLOW_PROD_SEED=1 gets past that, and then ADMIN_EMAIL/ADMIN_PASSWORD are
// required so the live site gets a real admin instead of fixtures.
const nextAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
const isProductionLike =
  process.env.NODE_ENV === "production" ||
  (nextAppUrl.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(nextAppUrl));

function assertSeedAllowed(): void {
  if (!isProductionLike) return;
  if (process.env.ALLOW_PROD_SEED !== "1") {
    console.error(
      "[seed] Refusing to run: this looks like a production environment " +
        `(NODE_ENV=${process.env.NODE_ENV ?? "unset"}, NEXT_PUBLIC_APP_URL=${nextAppUrl || "unset"}).`
    );
    console.error(
      "[seed] To seed production deliberately, re-run with ALLOW_PROD_SEED=1 " +
        "ADMIN_EMAIL=<your email> ADMIN_PASSWORD=<a strong password>."
    );
    process.exit(1);
  }
  const email = process.env.ADMIN_EMAIL ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!email || password.length < 8) {
    console.error(
      "[seed] ALLOW_PROD_SEED=1 requires ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) " +
        "so production never gets the dev fixture accounts."
    );
    process.exit(1);
  }
}

async function main() {
  assertSeedAllowed();

  // Exactly one of the two credential sets is active: dev fixtures locally,
  // a real ADMIN_EMAIL/ADMIN_PASSWORD admin on production-like runs.
  let devAdminHash: string | null = null;
  let devCustomerHash: string | null = null;
  let prodAdmin: { email: string; passwordHash: string } | null = null;

  if (isProductionLike) {
    // assertSeedAllowed() already guaranteed both are present and valid.
    prodAdmin = {
      email: process.env.ADMIN_EMAIL!,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD!, 10),
    };
  } else {
    devAdminHash = await bcrypt.hash("DevAdmin123!", 10);
    devCustomerHash = await bcrypt.hash("DevCustomer123!", 10);
  }

  if (prodAdmin) {
    await prisma.user.upsert({
      where: { email: prodAdmin.email },
      update: {},
      create: {
        email: prodAdmin.email,
        name: "Girah Admin",
        passwordHash: prodAdmin.passwordHash,
        role: Role.ADMIN,
      },
    });
  }

  if (devAdminHash !== null) {
    await prisma.user.upsert({
      where: { email: "dev-admin@girah.test" },
      update: {},
      create: {
        email: "dev-admin@girah.test",
        name: "Dev Admin",
        passwordHash: devAdminHash,
        role: Role.ADMIN,
      },
    });
  }

  if (devCustomerHash !== null) {
    await prisma.user.upsert({
      where: { email: "dev-customer@girah.test" },
      update: {},
      create: {
        email: "dev-customer@girah.test",
        name: "Dev Customer",
        passwordHash: devCustomerHash,
        role: Role.CUSTOMER,
      },
    });
  }

  const bouquets = await prisma.category.upsert({
    where: { slug: "bouquets" },
    update: {},
    create: { name: "Bouquets", slug: "bouquets" },
  });

  const keychains = await prisma.category.upsert({
    where: { slug: "keychains" },
    update: {},
    create: { name: "Keychains", slug: "keychains" },
  });

  const sunflower = await prisma.product.upsert({
    where: { slug: "crochet-sunflower-bouquet" },
    update: {},
    create: {
      name: "Crochet Sunflower Bouquet",
      slug: "crochet-sunflower-bouquet",
      description:
        "Handmade crochet sunflower bouquet, carefully arranged and wrapped with decorative paper and ribbon. A long-lasting alternative to fresh flowers.",
      categoryId: bouquets.id,
      images: {
        create: [
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127651/girah/crochet-sunflower-bouquet-main.png", sortOrder: 0 },
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127060/girah/crochet-sunflower-bouquet-01.png", sortOrder: 1 },
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127062/girah/crochet-sunflower-bouquet-02.png", sortOrder: 2 },
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127064/girah/crochet-sunflower-bouquet-03.png", sortOrder: 3 },
        ],
      },
      variations: {
        create: [
          { name: "Single Sunflower", price: 80000, stock: 10 },
          { name: "Small Bouquet", price: 180000, stock: 10 },
          { name: "Medium Bouquet", price: 280000, stock: 10 },
          { name: "Large Bouquet", price: 400000, stock: 10 },
          { name: "Full Floral Bouquet", price: 500000, stock: 10 },
        ],
      },
    },
  });

  const duck = await prisma.product.upsert({
    where: { slug: "crochet-duck-keychain" },
    update: {},
    create: {
      name: "Crochet Duck Keychain",
      slug: "crochet-duck-keychain",
      description:
        "Cute handmade crochet duck keychain, perfect for bags, keys, or as a small gift.",
      categoryId: keychains.id,
      images: {
        create: [
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127053/girah/crochet-duck-keychain-main.png", sortOrder: 0 },
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127637/girah/crochet-duck-keychain-01.png", sortOrder: 1 },
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127050/girah/crochet-duck-keychain-02.png", sortOrder: 2 },
        ],
      },
      variations: {
        create: [
          { name: "Single Duck", price: 70000, stock: 10 },
          { name: "Duck + Flower", price: 80000, stock: 10 },
          { name: "Set of 2", price: 130000, stock: 10 },
          { name: "Set of 3", price: 180000, stock: 10 },
        ],
      },
    },
  });

  const lily = await prisma.product.upsert({
    where: { slug: "crochet-lily-bouquet" },
    update: {},
    create: {
      name: "Crochet Lily Bouquet",
      slug: "crochet-lily-bouquet",
      description:
        "Handmade crocheted lily bouquet featuring a large white lily, small purple flowers, decorative leaves, and elegant wrapping.",
      categoryId: bouquets.id,
      images: {
        create: [
          { url: "https://res.cloudinary.com/ime2s2qz/image/upload/v1789127056/girah/crochet-lily-bouquet-main.png", sortOrder: 0 },
        ],
      },
      variations: {
        create: [
          { name: "Mini", price: 180000, stock: 10 },
          { name: "Classic", price: 280000, stock: 10 },
          { name: "Deluxe", price: 400000, stock: 10 },
          { name: "Premium", price: 550000, stock: 10 },
        ],
      },
    },
  });

  console.log("Seeded:", { sunflower: sunflower.id, duck: duck.id, lily: lily.id });
  console.log(
    isProductionLike
      ? `Production seed complete — admin account: ${prodAdmin?.email}`
      : "Development fixture accounts ensured (dev-admin / dev-customer)."
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
