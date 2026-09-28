import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

// Phase 17: runtime-rendered so the product list stays current without a
// rebuild, and the DB query never runs at build time (builds must not depend
// on a reachable database).
export const dynamic = "force-dynamic";

const staticPaths = [
  "",
  "/shop",
  "/about",
  "/contact",
  "/shipping",
  "/returns",
  "/privacy",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();

  const products = await db.product.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: { slug: "asc" },
  });

  return [
    ...staticPaths.map((path) => ({
      url: `${base}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];
}
