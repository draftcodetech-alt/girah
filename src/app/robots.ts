import type { MetadataRoute } from "next";

// Build-time static is fine: only reads NEXT_PUBLIC_APP_URL (baked at build
// from the deploy .env) — no runtime DB dependency.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/account/",
          "/wishlist/",
          "/order/",
          "/search",
          "/cart",
          "/checkout",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
