/** Zbieżne z `BLOCKED_SUBSCRIPTION_STATUSES` po stronie serwera (Stripe / checkout). */
export const SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT = new Set([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
])

export function subscriptionStatusBlocksNewCheckout(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase()
  return SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT.has(s)
}
