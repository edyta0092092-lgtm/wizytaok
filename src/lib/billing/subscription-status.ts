/** Zbieżne z `BLOCKED_SUBSCRIPTION_STATUSES` po stronie serwera (Stripe / checkout). */
export const SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT = new Set([
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "incomplete",
])

/** Statusy dające dostęp do operacyjnego panelu. */
export const ACTIVE_BUSINESS_ACCESS_STATUSES = new Set(["trialing", "active"])

export function subscriptionStatusBlocksNewCheckout(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase()
  return SUBSCRIPTION_STATUSES_BLOCKING_NEW_CHECKOUT.has(s)
}

export function hasActiveBusinessAccess(status: string | null | undefined): boolean {
  const s = String(status ?? "").trim().toLowerCase()
  if (!s || s === "none") return false
  return ACTIVE_BUSINESS_ACCESS_STATUSES.has(s)
}

/** Preferuje `subscription_status`, potem legacy `stripe_subscription_status`. */
export function resolveEffectiveSubscriptionStatus(
  subscriptionStatus: string | null | undefined,
  stripeSubscriptionStatus?: string | null | undefined,
): string | null {
  const primary = String(subscriptionStatus ?? "").trim()
  if (primary.length > 0) return primary.toLowerCase()
  const legacy = String(stripeSubscriptionStatus ?? "").trim()
  return legacy.length > 0 ? legacy.toLowerCase() : null
}
