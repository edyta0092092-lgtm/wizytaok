import type { Stripe } from "stripe"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TablesUpdate } from "@/types/database"

/**
 * Aktualizuje rekord firmy po zdarzeniach Stripe (webhook). Service role — tylko serwer.
 */
export async function upsertBusinessStripeFromSubscription(
  admin: SupabaseClient<Database>,
  businessId: string,
  input: {
    stripeCustomerId: string | null
    subscription: Stripe.Subscription | null
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch: TablesUpdate<"business_profiles"> = {
    updated_at: new Date().toISOString(),
  }

  if (input.stripeCustomerId) {
    patch.stripe_customer_id = input.stripeCustomerId
  }

  if (input.subscription) {
    patch.stripe_subscription_id = input.subscription.id
    patch.stripe_subscription_status = input.subscription.status
    const items = input.subscription.items?.data
    let endSec: number | null = null
    if (items?.length) {
      let max = 0
      for (const item of items) {
        const end = item.current_period_end
        if (typeof end === "number" && end > max) max = end
      }
      endSec = max > 0 ? max : null
    }
    patch.stripe_subscription_current_period_end =
      endSec !== null && endSec > 0
        ? new Date(endSec * 1000).toISOString()
        : null
  } else {
    patch.stripe_subscription_status = "canceled"
    patch.stripe_subscription_current_period_end = null
  }

  const { error } = await admin.from("business_profiles").update(patch).eq("id", businessId)
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export type SubscriptionUiStatus =
  | "none"
  | "trialing"
  | "active"
  | "payment_required"
  | "canceled"
  | "unknown"

/** Mapowanie statusu z bazy (Stripe) na klucz UI — bez blokowania dostępu do aplikacji. */
export function mapStripeSubscriptionToUiStatus(
  subscriptionId: string | null | undefined,
  statusRaw: string | null | undefined
): SubscriptionUiStatus {
  const sid = subscriptionId?.trim() ?? ""
  const s = (statusRaw ?? "").trim().toLowerCase()
  if (!sid && !s) return "none"
  if (s === "trialing") return "trialing"
  if (s === "active") return "active"
  if (s === "past_due" || s === "unpaid") return "payment_required"
  if (s === "canceled" || s === "incomplete_expired") return "canceled"
  return "unknown"
}
