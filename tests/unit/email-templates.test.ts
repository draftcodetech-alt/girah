import { describe, it, expect } from "vitest";
import {
  orderReceivedEmail,
  paymentResultEmail,
  orderStatusEmail,
  welcomeEmail,
  passwordResetEmail,
  type OrderMailData,
} from "@/lib/email-templates";

// Phase B: every transactional template renders with no unfilled holes.
// Pure builders — no transport, no database.
const ORDER: OrderMailData = {
  to: "buyer@example.com",
  customerName: "Test Buyer",
  orderNumber: "GIR-TEST-000001",
  total: 180000,
  paymentMethod: "COD",
  orderStatus: "CONFIRMED",
  paymentStatus: "PENDING",
  createdAt: new Date("2026-01-15T10:00:00Z"),
};

describe("email templates", () => {
  it("order-received differs COD vs SAFEPAY and carries facts", () => {
    const cod = orderReceivedEmail(ORDER);
    const online = orderReceivedEmail({ ...ORDER, paymentMethod: "SAFEPAY" });
    expect(cod.to).toBe("buyer@example.com");
    expect(cod.subject).toContain("GIR-TEST-000001");
    expect(cod.html).toContain("pay on delivery");
    expect(online.html).toContain("as soon as your payment completes");
    for (const mail of [cod, online]) {
      expect(mail.html).not.toMatch(/undefined|NaN|\$\{/);
      expect(mail.text).toContain("Rs.");
    }
  });

  it("payment-result covers all three outcomes distinctly", () => {
    const subjects = new Set<string>();
    for (const outcome of ["CONFIRMED", "FAILED", "REFUNDED"] as const) {
      const mail = paymentResultEmail(ORDER, outcome);
      subjects.add(mail.subject);
      expect(mail.html).toContain("GIR-TEST-000001");
      expect(mail.html).not.toMatch(/undefined/);
    }
    expect(subjects.size).toBe(3);
  });

  it("status emails cover shipped/delivered/cancelled distinctly", () => {
    const subjects = new Set<string>();
    for (const status of ["SHIPPED", "DELIVERED", "CANCELLED"] as const) {
      const mail = orderStatusEmail(ORDER, status);
      subjects.add(mail.subject);
      expect(mail.html).not.toMatch(/undefined/);
    }
    expect(subjects.size).toBe(3);
  });

  it("welcome and reset emails personalize and link", () => {
    const welcome = welcomeEmail({ to: "new@example.com", name: "New User" });
    expect(welcome.to).toBe("new@example.com");
    expect(welcome.html).toContain("New User");

    const reset = passwordResetEmail({
      to: "new@example.com",
      name: "New User",
      link: "https://shop.example/reset-password?token=abc",
    });
    expect(reset.html).toContain("token=abc");
    expect(reset.html).not.toMatch(/undefined/);
  });
});
