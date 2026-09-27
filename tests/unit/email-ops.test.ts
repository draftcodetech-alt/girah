import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  isEmailDevLogMode,
  sendEmail,
  sendEmailSafe,
} from "@/lib/email";
import {
  orderReceivedEmail,
  paymentResultEmail,
  orderStatusEmail,
  welcomeEmail,
  passwordResetEmail,
  type OrderMailData,
} from "@/lib/email-templates";

// Phase 14: transport mode selection (dev-log fallback), template content,
// and source guards over the four post-commit hook sites.

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: vi.fn().mockRejectedValue(new Error("transport down")) };
  },
}));

const ORDER: OrderMailData = {
  to: "buyer@girah.test",
  customerName: "Ayesha",
  orderNumber: "GIR-U1",
  total: 100_000,
  paymentMethod: "COD",
  createdAt: new Date("2026-09-20T10:00:00+05:00"),
};

function readSource(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

afterEach(() => {
  // Restore the suite-wide dev-log guard (tests/setup/env.ts) so a shared
  // worker never inherits a lingering real-key state from this file.
  process.env.RESEND_API_KEY = "ci-placeholder";
  vi.restoreAllMocks();
});

describe("dev-log mode selection", () => {
  it("falls back to dev-log when RESEND_API_KEY is absent", () => {
    delete process.env.RESEND_API_KEY;
    expect(isEmailDevLogMode()).toBe(true);
  });

  it("falls back to dev-log for the CI placeholder key", () => {
    process.env.RESEND_API_KEY = "ci-placeholder";
    expect(isEmailDevLogMode()).toBe(true);
  });

  it("uses the real transport when a key is configured", () => {
    process.env.RESEND_API_KEY = "re_real_key";
    expect(isEmailDevLogMode()).toBe(false);
  });
});

describe("sendEmail in dev-log mode", () => {
  it("logs recipient and subject instead of sending", async () => {
    delete process.env.RESEND_API_KEY;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendEmail({ to: "a@b.c", subject: "Hello", html: "<p>hi</p>" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain("[email] dev-log");
    expect(log.mock.calls[0][0]).toContain("to=a@b.c");
    expect(log.mock.calls[0][0]).toContain('subject="Hello"');
  });

  it("dev-logs for the CI placeholder key too", async () => {
    process.env.RESEND_API_KEY = "ci-placeholder";
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendEmail({ to: "a@b.c", subject: "CI", html: "<p>hi</p>" });
    expect(log.mock.calls[0][0]).toContain("[email] dev-log");
  });
});

describe("sendEmailSafe never throws", () => {
  it("swallows transport failures and logs them", async () => {
    process.env.RESEND_API_KEY = "re_real_key";
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendEmailSafe({ to: "a@b.c", subject: "Fails", html: "<p>hi</p>" })
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toContain("[email] send failed");
  });
});

describe("order email templates", () => {
  it("order-received (COD) carries the amount, date and pay-on-delivery copy", () => {
    const mail = orderReceivedEmail(ORDER);
    expect(mail.subject).toBe("Order received — #GIR-U1");
    expect(mail.html).toContain("Rs. 1,000.00");
    expect(mail.html).toContain("20 Sept 2026");
    expect(mail.html).toContain("pay on delivery");
    expect(mail.text).toContain("Order received — #GIR-U1");
  });

  it("order-received (Safepay) waits for payment confirmation", () => {
    const mail = orderReceivedEmail({ ...ORDER, paymentMethod: "SAFEPAY" });
    expect(mail.html).toContain("as soon as your payment completes");
    expect(mail.html).toContain("Online payment (Safepay)");
  });

  it("payment results have outcome-specific subjects and copy", () => {
    expect(paymentResultEmail(ORDER, "CONFIRMED").subject).toBe(
      "Payment confirmed — #GIR-U1"
    );
    const failed = paymentResultEmail(ORDER, "FAILED");
    expect(failed.subject).toBe("Payment failed — #GIR-U1");
    expect(failed.html).toContain("You can retry payment");
    const refunded = paymentResultEmail(ORDER, "REFUNDED");
    expect(refunded.subject).toBe("Payment refunded — #GIR-U1");
    expect(refunded.html).toContain("Rs. 1,000.00");
  });

  it("status emails carry per-status subjects", () => {
    expect(orderStatusEmail(ORDER, "SHIPPED").subject).toBe(
      "Your order has shipped — #GIR-U1"
    );
    expect(orderStatusEmail(ORDER, "DELIVERED").subject).toBe(
      "Order delivered — #GIR-U1"
    );
    expect(orderStatusEmail(ORDER, "CANCELLED").subject).toBe(
      "Order cancelled — #GIR-U1"
    );
  });

  it("cancellation copy only promises a refund when the payment was refunded", () => {
    const refunded = orderStatusEmail(
      { ...ORDER, paymentStatus: "REFUNDED" },
      "CANCELLED"
    );
    expect(refunded.html).toContain("payment has been refunded");
    const unpaid = orderStatusEmail({ ...ORDER, paymentStatus: "PENDING" }, "CANCELLED");
    expect(unpaid.html).not.toContain("payment has been refunded");
    expect(unpaid.html).toContain("any due refund is on its way");
  });

  it("welcome and reset emails carry the recipient and links", () => {
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3100";
    const welcome = welcomeEmail({ to: "a@b.c", name: "Ayesha" });
    expect(welcome.subject).toBe("Welcome to Girah");
    expect(welcome.html).toContain("Ayesha");
    expect(welcome.html).toContain("http://localhost:3100/login");

    const reset = passwordResetEmail({
      to: "a@b.c",
      name: "Ayesha",
      link: "http://localhost:3100/reset-password?token=abc123",
    });
    expect(reset.html).toContain("/reset-password?token=abc123");
    expect(reset.html).toContain("expires in 1 hour");
    expect(reset.html).toContain("safely ignore");
  });

  it("every builder returns a subject, html and plain-text body", () => {
    const mails = [
      orderReceivedEmail(ORDER),
      paymentResultEmail(ORDER, "CONFIRMED"),
      paymentResultEmail(ORDER, "FAILED"),
      paymentResultEmail(ORDER, "REFUNDED"),
      orderStatusEmail(ORDER, "SHIPPED"),
      orderStatusEmail(ORDER, "DELIVERED"),
      orderStatusEmail(ORDER, "CANCELLED"),
      welcomeEmail({ to: "a@b.c", name: "N" }),
      passwordResetEmail({ to: "a@b.c", name: "N", link: "http://x/y" }),
    ];
    for (const mail of mails) {
      expect(mail.subject.length).toBeGreaterThan(0);
      expect(mail.html.length).toBeGreaterThan(0);
      expect((mail.text ?? "").length).toBeGreaterThan(0);
      expect(mail.to.length).toBeGreaterThan(0);
    }
  });
});

describe("source guards — transport is lazy and dev-safe", () => {
  it("importing email.ts never constructs a client", () => {
    const src = readSource("src/lib/email.ts");
    expect(src).toMatch(/await import\("resend"\)/);
    expect(src).not.toMatch(/^import .* from "resend"/m);
  });

  it("all outbound mail goes through the never-throws wrapper", () => {
    expect(readSource("src/lib/email.ts")).toContain("export async function sendEmailSafe");
    const hooks = [
      "src/modules/checkout/actions.ts",
      "src/modules/payments/webhook-core.ts",
      "src/modules/orders/status-ops.ts",
      "src/modules/accounts/actions.ts",
    ];
    for (const file of hooks) {
      expect(readSource(file)).toMatch(/sendEmailSafe\(/);
    }
  });
});

describe("source guards — hook sites", () => {
  it("placeOrder sends order-received only after the order committed", () => {
    const src = readSource("src/modules/checkout/actions.ts");
    expect(src).toContain("orderReceivedEmail(");
    expect(src.indexOf("revalidatePath(")).toBeGreaterThan(-1);
    expect(src.indexOf("orderReceivedEmail(")).toBeGreaterThan(
      src.indexOf("revalidatePath(")
    );
  });

  it("webhook payment mails are gated on the CAS win", () => {
    const src = readSource("src/modules/payments/webhook-core.ts");
    const guarded = src.match(
      /if \(claimed\.count === 1\) await emailPaymentResult\(order, "(CONFIRMED|FAILED|REFUNDED)"\);/g
    );
    expect(guarded).not.toBeNull();
    expect(guarded).toHaveLength(3);
  });

  it("status mails cover exactly SHIPPED/DELIVERED/CANCELLED", () => {
    const src = readSource("src/modules/orders/status-ops.ts");
    const line = src.split("\n").find((l) => l.includes("const EMAILED_STATUSES"));
    expect(line).toBeDefined();
    expect(line).toContain("SHIPPED");
    expect(line).toContain("DELIVERED");
    expect(line).toContain("CANCELLED");
    expect(line).not.toMatch(/CONFIRMED|PROCESSING/);
    expect(src).toContain("const wasRefunded = next === \"CANCELLED\" && wasPaid;");
  });

  it("register welcomes new accounts", () => {
    expect(readSource("src/modules/accounts/actions.ts")).toContain("welcomeEmail(");
  });
});

describe("source guards — reset flow hardening", () => {
  const src = readSource("src/modules/accounts/actions.ts");

  it("rate-limits every attempt BEFORE looking the account up", () => {
    const fn = src.slice(
      src.indexOf("export async function requestPasswordReset"),
      src.indexOf("export async function resetPassword")
    );
    expect(fn).toContain("`pwreset:${email}`");
    expect(fn.indexOf("recordFailure(rateKey")).toBeGreaterThan(-1);
    expect(fn.indexOf("recordFailure(rateKey")).toBeLessThan(
      fn.indexOf("db.user.findFirst")
    );
  });

  it("answers identically whether or not the account exists", () => {
    const fn = src.slice(
      src.indexOf("export async function requestPasswordReset"),
      src.indexOf("export async function resetPassword")
    );
    const successes = fn.match(/return \{ success: true \};/g) ?? [];
    expect(successes).toHaveLength(1);
    // The single generic success sits AFTER the send (i.e. outside the
    // if (user) branch — a missing account falls through to it too).
    expect(fn.indexOf("return { success: true };")).toBeGreaterThan(
      fn.indexOf("sendEmailSafe(")
    );
  });

  it("reset kills sessions and consumes every token", () => {
    const fn = src.slice(src.indexOf("export async function resetPassword"));
    expect(fn).toContain("sessionVersion: { increment: 1 }");
    expect(fn).toContain("deleteMany({ where: { userId: record.userId } })");
    expect(src).toContain("RESET_TOKEN_TTL_MS = 60 * 60 * 1000");
  });
});

describe("source guards — forms", () => {
  it("the login form links to /forgot-password", () => {
    expect(readSource("src/components/storefront/LoginForm.tsx")).toContain(
      'href="/forgot-password"'
    );
  });
});
