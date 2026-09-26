import { describe, it, expect } from "vitest";
import { safeCallbackUrl, DEFAULT_CALLBACK_PATH } from "@/lib/callback-url";

// Phase 7: proxy.ts bounces signed-out /admin and /account visitors to
// /login?callbackUrl=... and LoginForm pushes it with router.push(). Every
// accepted value must be a same-origin path -- never an open redirect.

describe("safeCallbackUrl", () => {
  it("accepts normal same-origin paths", () => {
    expect(safeCallbackUrl("/admin/products")).toBe("/admin/products");
    expect(safeCallbackUrl("/account/orders")).toBe("/account/orders");
    expect(safeCallbackUrl("/")).toBe("/");
    expect(safeCallbackUrl("/product/some-slug?ref=email")).toBe(
      "/product/some-slug?ref=email"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(safeCallbackUrl("  /account  ")).toBe("/account");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackUrl("https://evil.com")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("http://evil.com/x")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("//evil.com")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("//evil.com/path")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("javascript:alert(1)")).toBe(DEFAULT_CALLBACK_PATH);
  });

  it("rejects backslash tricks browsers treat as //", () => {
    expect(safeCallbackUrl("/\\evil.com")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("/\\evil")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("/path\\to")).toBe(DEFAULT_CALLBACK_PATH);
  });

  it("rejects traversal and dot-containing paths", () => {
    expect(safeCallbackUrl("/../admin")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("/a/../b")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("/..")).toBe(DEFAULT_CALLBACK_PATH);
  });

  it("rejects control characters (newline, tab, NUL, DEL)", () => {
    expect(safeCallbackUrl("/a\nb")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("/a\tb")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl(`/a${String.fromCharCode(0)}b`)).toBe(
      DEFAULT_CALLBACK_PATH
    );
    expect(safeCallbackUrl(`/a${String.fromCharCode(127)}b`)).toBe(
      DEFAULT_CALLBACK_PATH
    );
  });

  it("rejects empty, oversized, and non-string input", () => {
    expect(safeCallbackUrl("")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl("   ")).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl(null)).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl(undefined)).toBe(DEFAULT_CALLBACK_PATH);
    expect(safeCallbackUrl(`/${"a".repeat(600)}`)).toBe(DEFAULT_CALLBACK_PATH);
  });

  it("honours a custom fallback", () => {
    expect(safeCallbackUrl("//evil.com", "/login")).toBe("/login");
    expect(safeCallbackUrl(undefined, "/login")).toBe("/login");
  });

  it("keeps the default export equal to the proxy's account landing", () => {
    expect(DEFAULT_CALLBACK_PATH).toBe("/account");
  });
});
