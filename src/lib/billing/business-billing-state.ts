import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"

export type BusinessBillingRow = {
  subscription_status: string | null
  stripe_subscription_status: string | null
  trial_used_at: string | null
  trial_started_at: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
}

export function hasStripeCustomerId(row: BusinessBillingRow | null | undefined): boolean {
  return Boolean(row?.stripe_customer_id?.trim())
}

export type BillingActivationScenario =
  | "loading"
  | "subscription_active"
  | "trial_never_used"
  | "trial_consumed"
  | "payment_past_due"
  | "subscription_canceled"

export function resolveBillingActivationScenario(
  row: BusinessBillingRow | null,
  loading: boolean,
): BillingActivationScenario {
  if (loading) return "loading"
  if (!row) return "trial_never_used"

  const status = resolveEffectiveSubscriptionStatus(
    row.subscription_status,
    row.stripe_subscription_status,
  )

  if (hasActiveBusinessAccess(status)) {
    return "subscription_active"
  }

  if (status === "past_due" || status === "unpaid") {
    return "payment_past_due"
  }

  if (status === "canceled" || status === "incomplete_expired") {
    return "subscription_canceled"
  }

  const trialConsumed = Boolean(row.trial_used_at?.trim() || row.trial_started_at?.trim())
  if (!trialConsumed) {
    return "trial_never_used"
  }

  return "trial_consumed"
}
