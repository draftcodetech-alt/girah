export const DEFAULT_CALLBACK_PATH = "/account";

// Login success (and the proxy's pre-login bounce) must only ever navigate to
// a same-origin path: callbackUrl arrives straight from the query string, so
// "//evil.com", "/\evil.com" or "https://evil.com" would otherwise become an
// open redirect the moment it reaches router.push / window.location.
export function safeCallbackUrl(
  raw: string | null | undefined,
  fallback: string = DEFAULT_CALLBACK_PATH
): string {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim();
  if (value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.includes("..")) return fallback;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 127) return fallback;
  }
  return value;
}
