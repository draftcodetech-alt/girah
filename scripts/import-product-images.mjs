// Phase: product photo ingestion (images/ → public/products/<slug>/).
//
// The owner's 61 source PNGs (12 numbered folders) become the storefront
// gallery set. Three kinds of source are handled:
//
//   1. Real cut-outs (56): alpha channel already removes the background.
//   2. Fake transparency (4): a checkerboard was flattened into the pixels.
//      We re-key it out — classify neutral light pixels, drop the components
//      that touch the border or are large enclosed patches (the checkerboard
//      seen through a keyring loop), erode 1px and feather so no grey fringe
//      or checker speck survives.
//   3. A real photo (Duck_Keychain_06): padded with its own border colour and
//      edge-feathered, so the photo dissolves into the canvas instead of
//      showing a hard rectangle.
//
// Every display surface renders with `object-cover`, and the tightest frame —
// the 48px square checkout thumb — crops ~12.5% off the top/bottom of a 4:5
// image (the shop card stage crops ~9%). So each image lands on a 1200x1500
// (4:5) canvas with the subject confined to the central 75% of the height:
// nothing ever clips, and the padded margins let the sage/cream container
// background show through.
//
// Usage: node scripts/import-product-images.mjs
// Writes public/products/<slug>/NN.webp + scripts/.image-manifest.json;
// scripts/link-product-images.mts then syncs the ProductImage rows.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "images");
const OUT = path.join(ROOT, "public", "products");
const MANIFEST = path.join(ROOT, "scripts", ".image-manifest.json");
const SHEET = "/tmp/opencode/product-images-sheet.png";

const CANVAS_W = 1200;
const CANVAS_H = 1500; // 4:5 — matches every gallery/cart/mini-cart frame.
const SAFE_W = 0.92; // subject width budget (nothing crops horizontally).
const SAFE_H = 0.75; // subject height budget (checkout thumb crops 12.5%/end).

/** `01_Crochet_Duck_Keychain` → `crochet-duck-keychain` (matches product slugs). */
function slugFromFolder(folder) {
  return folder.replace(/^\d+_/, "").toLowerCase().replaceAll("_", "-");
}

/** Content bounding box from alpha > 10; opaque frames report the full image. */
function contentBox(data, W, H) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: W, h: H };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function isNeutralLight(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn <= 14 && (r + g + b) / 3 >= 165;
}

/**
 * Re-key a flattened checkerboard: classify neutral-light pixels, then drop
 * every component that either escapes to the border or is a large enclosed
 * patch (checkerboard seen through a keyring / hanging loop). Small enclosed
 * neutral patches are kept — they may be real product whites (pearls, petals).
 */
function removeCheckerboard(data, W, H) {
  const mask = new Uint8Array(W * H);
  let neutral = 0;
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (isNeutralLight(data[i], data[i + 1], data[i + 2])) {
      mask[p] = 1;
      neutral++;
    }
  }

  const comp = new Int32Array(W * H).fill(-1);
  const stack = [];
  const drop = new Uint8Array(W * H);
  let dropped = 0;

  for (let seed = 0; seed < W * H; seed++) {
    if (!mask[seed] || comp[seed] >= 0) continue;
    const id = seed;
    let area = 0, border = false;
    stack.length = 0;
    stack.push(seed);
    comp[seed] = id;
    const members = [];
    while (stack.length) {
      const q = stack.pop();
      area++;
      members.push(q);
      const x = q % W, y = (q / W) | 0;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      if (x > 0 && mask[q - 1] && comp[q - 1] < 0) { comp[q - 1] = id; stack.push(q - 1); }
      if (x < W - 1 && mask[q + 1] && comp[q + 1] < 0) { comp[q + 1] = id; stack.push(q + 1); }
      if (y > 0 && mask[q - W] && comp[q - W] < 0) { comp[q - W] = id; stack.push(q - W); }
      if (y < H - 1 && mask[q + W] && comp[q + W] < 0) { comp[q + W] = id; stack.push(q + W); }
    }
    if (border || area >= 3000) {
      for (const m of members) {
        if (drop[m] === 0) dropped++;
        drop[m] = 1;
      }
    }
  }

  // Shrink the kept subject by 1px (kills anti-aliased checker fringe), then
  // feather alpha over ~2px so the cut edge is soft, not stair-stepped.
  const alpha = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) alpha[p] = drop[p] ? 0 : 255;
  const eroded = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      let a = alpha[p];
      if (a > 0) {
        if (x > 0) a = Math.min(a, alpha[p - 1]);
        if (x < W - 1) a = Math.min(a, alpha[p + 1]);
        if (y > 0) a = Math.min(a, alpha[p - W]);
        if (y < H - 1) a = Math.min(a, alpha[p + W]);
      }
      eroded[p] = a;
    }
  }
  let front = eroded, back = eroded.slice();
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        let sum = front[p], n = 1;
        if (x > 0) { sum += front[p - 1]; n++; }
        if (x < W - 1) { sum += front[p + 1]; n++; }
        if (y > 0) { sum += front[p - W]; n++; }
        if (y < H - 1) { sum += front[p + W]; n++; }
        back[p] = Math.round(sum / n);
      }
    }
    [front, back] = [back, front];
  }
  for (let p = 0; p < W * H; p++) data[p * 4 + 3] = front[p];
  return { removed: dropped, classified: neutral };
}

/** Median colour of a 6px border ring — the pad colour for real photos. */
function borderColor(data, W, H) {
  const rs = [], gs = [], bs = [];
  const band = 6;
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      if (x < band || y < band || x >= W - band || y >= H - band) {
        const i = (y * W + x) * 4;
        rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]);
      }
    }
  }
  const med = (a) => a.sort((x, y) => x - y)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}

/** Fade the outer `px` of a photo into transparency so the pad blends. */
function featherEdges(data, W, H, px) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (d < px) {
        const t = d / px;
        data[(y * W + x) * 4 + 3] = Math.round(data[(y * W + x) * 4 + 3] * t);
      }
    }
  }
}

async function main() {
  const folders = fs.readdirSync(SRC).filter((n) => fs.statSync(path.join(SRC, n)).isDirectory()).sort();
  fs.mkdirSync(OUT, { recursive: true });

  const manifest = {};
  const sheetCells = [];
  let files = 0;
  let bytes = 0;

  for (const folder of folders) {
    const slug = slugFromFolder(folder);
    const dirOut = path.join(OUT, slug);
    fs.mkdirSync(dirOut, { recursive: true });

    const sources = fs.readdirSync(path.join(SRC, folder)).filter((f) => f.toLowerCase().endsWith(".png")).sort();
    const urls = [];

    for (let i = 0; i < sources.length; i++) {
      const srcFile = path.join(SRC, folder, sources[i]);
      const { data, info } = await sharp(srcFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const { width: W, height: H } = info;

      let clear = 0;
      for (let p = 3; p < data.length; p += 4) if (data[p] < 8) clear++;
      const isCutout = clear / (W * H) > 0.01;

      let kind = "cutout";
      let pad = null;
      if (isCutout) {
        // Guard: a cut-out should not still carry opaque checkerboard patches.
        let suspect = 0;
        for (let p = 0; p < W * H; p++) {
          const i4 = p * 4;
          if (data[i4 + 3] > 200 && isNeutralLight(data[i4], data[i4 + 1], data[i4 + 2])) suspect++;
        }
        if (suspect / (W * H) > 0.04) console.warn(`  ! ${folder}/${sources[i]}: ${((suspect / (W * H)) * 100).toFixed(1)}% opaque neutral pixels left on a cut-out`);
      } else {
        // No transparency: either a flattened checkerboard or a real photo.
        let borderNeutral = 0, borderTotal = 0;
        const band = 8;
        for (let y = 0; y < H; y += 2) {
          for (let x = 0; x < W; x += 2) {
            if (x < band || y < band || x >= W - band || y >= H - band) {
              const i = (y * W + x) * 4;
              borderTotal++;
              if (isNeutralLight(data[i], data[i + 1], data[i + 2])) borderNeutral++;
            }
          }
        }
        if (borderNeutral / borderTotal > 0.6) {
          kind = "checker";
          const r = removeCheckerboard(data, W, H);
          console.log(`  de-checkered ${folder}/${sources[i]}: dropped ${r.removed} px of ${r.classified} classified`);
        } else {
          kind = "photo";
          pad = borderColor(data, W, H);
          featherEdges(data, W, H, 30);
          console.log(`  photo pad ${folder}/${sources[i]}: rgb(${pad.join(",")})`);
        }
      }

      const box = contentBox(data, W, H);
      const scale = Math.min((CANVAS_W * SAFE_W) / box.w, (CANVAS_H * SAFE_H) / box.h, 1);
      // Resize the WHOLE frame by `scale`, then place it so the content box
      // lands centred on the canvas (the subject's bounding box, not the
      // frame's, is what gets centred — source margins are asymmetric).
      const rw = Math.max(1, Math.round(W * scale));
      const rh = Math.max(1, Math.round(H * scale));
      const left = Math.round((CANVAS_W - box.w * scale) / 2 - box.x * scale);
      const top = Math.round((CANVAS_H - box.h * scale) / 2 - box.y * scale);

      const { data: resized } = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
        .resize(rw, rh, { fit: "fill" })
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Blit onto the canvas (JS-side: sharp's composite can't offset raw).
      const canvas = Buffer.alloc(CANVAS_W * CANVAS_H * 4);
      if (pad) {
        for (let p = 0; p < CANVAS_W * CANVAS_H; p++) {
          canvas[p * 4] = pad[0];
          canvas[p * 4 + 1] = pad[1];
          canvas[p * 4 + 2] = pad[2];
          canvas[p * 4 + 3] = 255;
        }
      }
      for (let y = 0; y < rh; y++) {
        const cy = top + y;
        if (cy < 0 || cy >= CANVAS_H) continue;
        for (let x = 0; x < rw; x++) {
          const cx = left + x;
          if (cx < 0 || cx >= CANVAS_W) continue;
          const s = (y * rw + x) * 4;
          const d = (cy * CANVAS_W + cx) * 4;
          // Source-over (cut-outs have soft alpha; photo pads are opaque).
          const sa = resized[s + 3];
          if (sa === 255 || canvas[d + 3] === 0) {
            canvas[d] = resized[s];
            canvas[d + 1] = resized[s + 1];
            canvas[d + 2] = resized[s + 2];
            canvas[d + 3] = sa;
          } else if (sa > 0) {
            const da = canvas[d + 3] / 255;
            const a = sa / 255 + da * (1 - sa / 255);
            canvas[d] = Math.round((resized[s] * sa / 255 + canvas[d] * da * (1 - sa / 255)) / a);
            canvas[d + 1] = Math.round((resized[s + 1] * sa / 255 + canvas[d + 1] * da * (1 - sa / 255)) / a);
            canvas[d + 2] = Math.round((resized[s + 2] * sa / 255 + canvas[d + 2] * da * (1 - sa / 255)) / a);
            canvas[d + 3] = Math.round(a * 255);
          }
        }
      }

      const outName = `${String(i + 1).padStart(2, "0")}.webp`;
      const outFile = path.join(dirOut, outName);
      await sharp(canvas, { raw: { width: CANVAS_W, height: CANVAS_H, channels: 4 } })
        .webp({ quality: 76, effort: 6 })
        .toFile(outFile);

      const url = `/products/${slug}/${outName}`;
      urls.push(url);
      sheetCells.push({ url: outFile, label: `${slug} ${outName}` });
      files++;
      bytes += fs.statSync(outFile).size;
      console.log(`${folder}/${sources[i]} [${kind}] -> ${url} (content ${Math.round(box.w * scale)}x${Math.round(box.h * scale)} @ ${left},${top})`);
    }
    manifest[slug] = urls;
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  // QA contact sheet: sage background (the gallery colour) so any leftover
  // checkerboard, fringe or hard photo edge is obvious at a glance.
  const COLS = 8;
  const CELL = 200;
  const rows = Math.ceil(sheetCells.length / COLS);
  const thumbs = await Promise.all(
    sheetCells.map((c) => sharp(c.url).resize(CELL - 8, CELL - 8, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer())
  );
  const sheet = sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 4, background: { r: 234, g: 239, b: 228, alpha: 1 } } });
  await sheet
    .composite(thumbs.map((input, i) => ({ input, left: (i % COLS) * CELL + 4, top: ((i / COLS) | 0) * CELL + 4 })))
    .png()
    .toFile(SHEET);

  console.log(`\n${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB -> public/products`);
  console.log(`manifest: scripts/.image-manifest.json | contact sheet: ${SHEET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
