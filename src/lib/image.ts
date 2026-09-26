/**
 * `next/image` throws at render time when the src host isn't in
 * `images.remotePatterns` (only res.cloudinary.com is). Admin-entered URLs are
 * always Cloudinary, but a stray/legacy row must degrade to a placeholder
 * instead of 500-ing the page it renders on.
 */
export function isOptimizableImageUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}
