import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// NOTE: TEST ACCOUNTS BELOW ARE LOCAL DEVELOPMENT ONLY.
// Never reuse these credentials anywhere real; never run this seed against production.

async function main() {
  const adminPasswordHash = await bcrypt.hash("DevAdmin123!", 10);
  const customerPasswordHash = await bcrypt.hash("DevCustomer123!", 10);

  await prisma.user.upsert({
    where: { email: "dev-admin@girah.test" },
    update: {},
    create: {
      email: "dev-admin@girah.test",
      name: "Dev Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "dev-customer@girah.test" },
    update: {},
    create: {
      email: "dev-customer@girah.test",
      name: "Dev Customer",
      passwordHash: customerPasswordHash,
      role: Role.CUSTOMER,
    },
  });

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
