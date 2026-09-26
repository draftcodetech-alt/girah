import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phase 11: admin image uploads travel as multipart Server Action bodies.
  // The default cap is 1MB — real product photos exceed it — so raise it just
  // above the 3.5MB in-app limit (multipart boundaries/headers need headroom,
  // per the installed Next docs on serverActions.bodySizeLimit).
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
