import type { NextConfig } from "next";

const isCloudflareBuild = process.env.CF_BUILD === "1";

const nextConfig: NextConfig = {
  // Phase 11: admin image uploads travel as multipart Server Action bodies.
  // The default cap is 1MB — real product photos exceed it — so raise it just
  // above the 3.5MB in-app limit (multipart boundaries/headers need headroom,
  // per the installed Next docs on serverActions.bodySizeLimit). Kept a
  // comfortable 1.5MB above the in-app cap so files in the 3.5–4.5MB range
  // reach the action and get the graceful "smaller than 3.5 MB" refusal
  // instead of an opaque framework 500 — while still bounding request bodies.
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  images: {
    unoptimized: isCloudflareBuild,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
