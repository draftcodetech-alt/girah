import { existsSync, readFileSync, writeFileSync } from "node:fs";

// Next 16 keeps a dead-code @vercel/og (satori + resvg.wasm ~1.4 MB) import in
// the ImageResponse module even when the app never renders OG images. On
// Cloudflare that costs ~0.6 MB of the 3 MiB worker gzip budget, and OpenNext's
// own alias misses the import (its turbopack patch rewrites the module id
// first). We never use ImageResponse, so the import is stubbed out before
// `opennextjs-cloudflare build`. Idempotent; fails loudly if a Next upgrade
// changes the text so the build never silently regresses.

const TARGETS = [
  "node_modules/next/dist/server/og/image-response.js",
  "node_modules/next/dist/esm/server/og/image-response.js",
  "node_modules/next/dist/server/og/cache-image-response.js",
  "node_modules/next/dist/esm/server/og/cache-image-response.js",
];

const TERNARY_IMPORT =
  "return import(process.env.NEXT_RUNTIME === 'edge' ? 'next/dist/compiled/@vercel/og/index.edge.js' : 'next/dist/compiled/@vercel/og/index.node.js');";
const NODE_IMPORT = "return import('next/dist/compiled/@vercel/og/index.node.js');";
const STUB = "return Promise.reject(new Error('ImageResponse is not available in this build'));";

let patched = 0;
let already = 0;
let missing = 0;

for (const file of TARGETS) {
  if (!existsSync(file)) {
    missing += 1;
    continue;
  }
  const src = readFileSync(file, "utf8");
  if (src.includes(STUB)) {
    already += 1;
    continue;
  }
  const next = src.split(TERNARY_IMPORT).join(STUB).split(NODE_IMPORT).join(STUB);
  if (next === src) {
    console.error(
      `[patch-next-og] pattern not found in ${file} — Next.js changed the ImageResponse import; update scripts/patch-next-og.mjs before deploying.`
    );
    process.exit(1);
  }
  writeFileSync(file, next);
  patched += 1;
}

console.log(`[patch-next-og] patched=${patched} already=${already} missing=${missing}`);
