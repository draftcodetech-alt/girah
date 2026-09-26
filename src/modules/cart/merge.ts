import { db } from "@/lib/db";
import { getGuestId, clearGuestId } from "./guest";
import { MAX_QUANTITY } from "./ops";

// Phase 5 — guest-cart merge. A browsing guest carries a cart under the
// `girah_guest_id` cookie; the moment they sign in, resolveCartIdentity starts
// resolving to `{userId}` and that guest cart used to be orphaned (H: "guest
// cart never merged on login"). This core MOVES the guest lines into the
// account cart inside one transaction, then the wrapper clears the cookie.

export async function mergeGuestCartCore(guestId: string, userId: string): Promise<void> {
  const guestCart = await db.cart.findUnique({ where: { guestId }, include: { items: true } });
  if (!guestCart) return; // stale cookie — nothing to merge (caller clears it)

  if (guestCart.items.length === 0) {
    await db.cart.delete({ where: { id: guestCart.id } });
    return;
  }

  // Find-or-create the account cart. `userId` is @unique, so upsert is the
  // race-safe way to say "the one cart for this user".
  const userCart = await db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  if (userCart.id === guestCart.id) {
    // Defensive: this cart already belongs to the user (both keys set) —
    // just drop the guest marker so it stops resolving as a guest cart.
    await db.cart.update({ where: { id: guestCart.id }, data: { guestId: null } });
    return;
  }

  await db.$transaction(async (tx) => {
    for (const guestItem of guestCart.items) {
      // Same variation in both carts → quantities SUM (capped below).
      // `increment` is atomic, so two devices merging concurrently can't
      // lose a line; the clamp pass afterwards enforces the 999 ceiling
      // the cart actions enforce everywhere else (ops.MAX_QUANTITY).
      await tx.cartItem.upsert({
        where: {
          cartId_variationId: { cartId: userCart.id, variationId: guestItem.variationId },
        },
        update: { quantity: { increment: guestItem.quantity } },
        create: {
          cartId: userCart.id,
          variationId: guestItem.variationId,
          quantity: Math.min(guestItem.quantity, MAX_QUANTITY),
        },
      });
    }

    await tx.cartItem.updateMany({
      where: { cartId: userCart.id, quantity: { gt: MAX_QUANTITY } },
      data: { quantity: MAX_QUANTITY },
    });

    // Cascade deletes the guest lines — the guest cart must not survive the
    // move or the same items would re-merge on a later login.
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}

// Request-scoped wrapper: reads the guest cookie, merges, clears it.
// Called ONLY from server actions (cookies() is writable there). The cookie
// is cleared AFTER a successful merge — if merging throws, the cookie stays
// and the next login retries, so nothing is ever silently lost.
export async function mergeGuestCartForCurrentUser(userId: string): Promise<void> {
  const guestId = await getGuestId();
  if (!guestId) return;
  await mergeGuestCartCore(guestId, userId);
  await clearGuestId();
}
