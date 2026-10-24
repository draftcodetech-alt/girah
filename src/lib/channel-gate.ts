export type LoginChannel = "customer" | "executive";

/**
 * Owner spec (2026-10-24, single-owner store): sign-in is split into two
 * channels. The storefront (/login) can only ever produce CUSTOMER
 * sessions — an admin can never be signed in from the customer channel;
 * the executive door (/executive/login) only signs the one ADMIN in.
 *
 * Shared by authorize() in lib/auth.ts (the credential choke point every
 * login passes through, including raw /api/auth posts) and the login()
 * action, so both enforce the identical rule.
 */
export function isChannelAllowed(
  role: "CUSTOMER" | "ADMIN",
  channel: unknown
): boolean {
  const viaExecutiveDoor = channel === "executive";
  return role === "ADMIN" ? viaExecutiveDoor : !viaExecutiveDoor;
}
