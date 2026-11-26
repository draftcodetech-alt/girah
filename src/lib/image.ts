/**
 * `next/image` throws at render time when the src host isn't allowed by
 * `images.remotePatterns` (only res.cloudinary.com is) or by `localPatterns`
 * (unset → every same-origin path is allowed). Admin-entered URLs are
 * Cloudinary, seeded catalogue photos are local `/products/...` files, and a
 * stray/legacy row must degrade to a placeholder instead of 500-ing the page
 * it renders on.
 */
export function isOptimizableImageUrl(url: string): boolean {
  // Same-origin asset (must not be protocol-relative `//host`, which would
  // escape to another origin).
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    return new URL(url).hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}
