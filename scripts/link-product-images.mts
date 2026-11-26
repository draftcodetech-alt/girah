// Sync ProductImage rows with the files written by import-product-images.mjs.
//
// Replaces the superseded Cloudinary seed shots (old studio-photo iteration)
// with the new cut-out set: main view first (`01.webp` → sortOrder 0), then
// the angle/detail variants in numeric order. Run after the import script:
//
//   DIRECT_URL=postgresql://... npx tsx scripts/link-product-images.mts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const MANIFEST = join(process.cwd(), "scripts", ".image-manifest.json");

async function main() {
  if (!existsSync(MANIFEST)) {
    throw new Error("scripts/.image-manifest.json missing — run scripts/import-product-images.mjs first");
  }
  const manifest: Record<string, string[]> = JSON.parse(readFileSync(MANIFEST, "utf8"));

  // WebSocket adapter (not HTTP): the writes run as a unit and HTTP mode has
  // no transaction support. Same wiring as src/lib/db.ts.
  neonConfig.webSocketConstructor = ws;
  const db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DIRECT_URL! }),
  });
  let replaced = 0;
  let created = 0;

  try {
    for (const [slug, urls] of Object.entries(manifest)) {
      const product = await db.product.findUnique({ where: { slug }, select: { id: true, name: true } });
      if (!product) throw new Error(`no product with slug "${slug}"`);

      // Files must exist before their rows do (a stale manifest would 404).
      for (const url of urls) {
        if (!existsSync(join(process.cwd(), "public", url))) {
          throw new Error(`public${url} missing — re-run the import script`);
        }
      }

      const { count } = await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.productImage.createMany({
        data: urls.map((url, sortOrder) => ({ productId: product.id, url, sortOrder })),
      });
      replaced += count;
      created += urls.length;
      console.log(`${product.name}: ${count} old row(s) replaced with ${urls.length} image(s)`);
    }
  } finally {
    await db.$disconnect();
  }

  console.log(`\ndone — ${created} ProductImage rows written, ${replaced} old row(s) removed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
