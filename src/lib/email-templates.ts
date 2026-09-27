// Phase 14: pure email template builders — no I/O, no config, no "use
// server", so unit tests can assert subjects, money and dates directly.
// Plain inline-styled HTML (email clients don't run stylesheets) using the
// same palette as the storefront tokens.

import { formatPrice, formatDate } from "@/lib/format";
import type { SendEmailInput } from "@/lib/email";

export type OrderMailData = {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
  paymentMethod: string;
  orderStatus?: string;
  paymentStatus?: string;
  createdAt?: Date;
  /** Confirmation/account link — omit where none applies. */
  link?: string;
};

export type PaymentOutcome = "CONFIRMED" | "FAILED" | "REFUNDED";
export type CustomerStatusUpdate = "SHIPPED" | "DELIVERED" | "CANCELLED";

const BASE = () => process.env.NEXT_PUBLIC_APP_URL ?? "";

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on delivery",
  SAFEPAY: "Online payment (Safepay)",
};

function paymentLabel(method: string): string {
  return PAYMENT_LABELS[method] ?? method;
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f7f4;font-family:Arial,Helvetica,sans-serif;color:#2b2f2a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <p style="font-size:20px;font-weight:bold;color:#526b5a;letter-spacing:0.14em;margin:0 0 16px;">GIRAH</p>
      <div style="background:#ffffff;border:1px solid #e3e5df;border-radius:12px;padding:28px 24px;">
        <h1 style="font-size:18px;margin:0 0 16px;color:#2b2f2a;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="font-size:12px;color:#7a7f78;margin-top:16px;">Girah — handcrafted flowers &amp; gifts. You receive this email because an account or order exists for this address.</p>
    </div>
  </body>
</html>`;
}

function orderFacts(data: OrderMailData, extraRows = ""): string {
  const rows = [
    `<tr><td style="padding:6px 0;color:#7a7f78;">Order</td><td style="padding:6px 0;text-align:right;">#${data.orderNumber}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#7a7f78;">Total</td><td style="padding:6px 0;text-align:right;">${formatPrice(data.total)}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#7a7f78;">Payment</td><td style="padding:6px 0;text-align:right;">${paymentLabel(data.paymentMethod)}</td></tr>`,
    ...(data.createdAt
      ? [`<tr><td style="padding:6px 0;color:#7a7f78;">Placed</td><td style="padding:6px 0;text-align:right;">${formatDate(data.createdAt)}</td></tr>`]
      : []),
    extraRows,
  ].join("");
  return `<table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">${rows}</table>`;
}

function paragraph(text: string): string {
  return `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">${text}</p>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0;"><a href="${href}" style="display:inline-block;background:#526b5a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:bold;">${label}</a></p>`;
}

function textBlock(lines: string[]): string {
  return lines.join("\n");
}

export function orderReceivedEmail(data: OrderMailData): SendEmailInput {
  const isSafepay = data.paymentMethod === "SAFEPAY";
  const intro = isSafepay
    ? `Thanks, ${data.customerName}! We've received your order and it will be confirmed as soon as your payment completes.`
    : `Thanks, ${data.customerName}! We've received your order and will start preparing it shortly. You'll pay on delivery.`;
  return {
    to: data.to,
    subject: `Order received — #${data.orderNumber}`,
    html: shell(
      "Order received",
      paragraph(intro) +
        orderFacts(data) +
        (data.link ? button(data.link, "View order") : "")
    ),
    text: textBlock([`Order received — #${data.orderNumber}`, "", intro, "", `Total: ${formatPrice(data.total)}`, `Payment: ${paymentLabel(data.paymentMethod)}`]),
  };
}

export function paymentResultEmail(data: OrderMailData, outcome: PaymentOutcome): SendEmailInput {
  const copy: Record<PaymentOutcome, { title: string; intro: string; subject: string }> = {
    CONFIRMED: {
      title: "Payment confirmed",
      intro: `We've confirmed your payment for order #${data.orderNumber}. It now moves into preparation.`,
      subject: `Payment confirmed — #${data.orderNumber}`,
    },
    FAILED: {
      title: "Payment failed",
      intro: `We couldn't confirm the payment for order #${data.orderNumber}. You can retry payment from the order page — nothing has been charged.`,
      subject: `Payment failed — #${data.orderNumber}`,
    },
    REFUNDED: {
      title: "Payment refunded",
      intro: `Your payment of ${formatPrice(data.total)} for order #${data.orderNumber} has been refunded. Depending on your bank it may take a few days to appear.`,
      subject: `Payment refunded — #${data.orderNumber}`,
    },
  };
  const c = copy[outcome];
  return {
    to: data.to,
    subject: c.subject,
    html: shell(c.title, paragraph(c.intro) + orderFacts(data) + (data.link ? button(data.link, "View order") : "")),
    text: textBlock([c.subject, "", c.intro]),
  };
}

export function orderStatusEmail(data: OrderMailData, status: CustomerStatusUpdate): SendEmailInput {
  const copy: Record<CustomerStatusUpdate, { title: string; intro: string; subject: string }> = {
    SHIPPED: {
      title: "Your order has shipped",
      intro: `Order #${data.orderNumber} is on its way to you.`,
      subject: `Your order has shipped — #${data.orderNumber}`,
    },
    DELIVERED: {
      title: "Your order was delivered",
      intro: `Order #${data.orderNumber} has been delivered. We hope the flowers brighten someone's day.`,
      subject: `Order delivered — #${data.orderNumber}`,
    },
    CANCELLED: {
      title: "Order cancelled",
      intro:
        data.paymentStatus === "REFUNDED"
          ? `Order #${data.orderNumber} was cancelled and your payment has been refunded.`
          : `Order #${data.orderNumber} was cancelled. If you already paid, any due refund is on its way.`,
      subject: `Order cancelled — #${data.orderNumber}`,
    },
  };
  const c = copy[status];
  return {
    to: data.to,
    subject: c.subject,
    html: shell(c.title, paragraph(c.intro) + orderFacts(data) + (data.link ? button(data.link, "View order") : "")),
    text: textBlock([c.subject, "", c.intro]),
  };
}

export function welcomeEmail(data: { to: string; name: string }): SendEmailInput {
  const intro = `Welcome to Girah, ${data.name}! Your account is ready — sign in to track orders, save addresses and reuse your details at checkout.`;
  return {
    to: data.to,
    subject: "Welcome to Girah",
    html: shell(
      "Welcome to Girah",
      paragraph(intro) + (BASE() ? button(`${BASE()}/login`, "Sign in") : "")
    ),
    text: textBlock(["Welcome to Girah", "", intro]),
  };
}

export function passwordResetEmail(data: { to: string; name: string; link: string }): SendEmailInput {
  const intro = `Hi ${data.name}, we received a request to reset your password. The link below works once and expires in 1 hour.`;
  const safety = "If you didn't request this, you can safely ignore this email — your password stays unchanged.";
  return {
    to: data.to,
    subject: "Reset your Girah password",
    html: shell(
      "Reset your password",
      paragraph(intro) +
        button(data.link, "Reset password") +
        paragraph(`<span style="font-size:12px;color:#7a7f78;">${safety}</span>`)
    ),
    text: textBlock(["Reset your Girah password", "", intro, "", data.link, "", safety]),
  };
}
