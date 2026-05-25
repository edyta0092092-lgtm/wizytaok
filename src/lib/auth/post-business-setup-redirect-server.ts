import type { User } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { evaluateTrialStartEligibility } from "@/lib/billing/trial-eligibility-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

function billingChoicePath(params?: Record<string, string>): string {
  const qs = new URLSearchParams(params ?? {})
  if (qs.size === 0) return "/activate-access"
  return `/activate-access?${qs.toString()}`
}

/**
 * Po zapisie profilu firmy (OAuth setup): trial / paywall / panel — wyłącznie server.
 */
export async function resolvePostBusinessSetupRedirect(
  user: User,
  profileRow: Database["public"]["Tables"]["business_profiles"]["Row"] | null,
): Promise<string> {
  const status = resolveEffectiveSubscriptionStatus(
    profileRow?.subscription_status ?? null,
    profileRow?.stripe_subscription_status ?? null,
  )

  if (hasActiveBusinessAccess(status)) {
    return "/dashboard"
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return billingChoicePath()
  }

  const row =
    profileRow ??
    (
      await admin
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle()
    ).data

  if (!row?.id) {
    return billingChoicePath()
  }

  const eligibility = await evaluateTrialStartEligibility(admin, {
    userId: user.id,
    userEmail: user.email,
    businessProfile: row,
  })

  if (eligibility.blocked) {
    return billingChoicePath({ trial_blocked: "1" })
  }

  return billingChoicePath()
}
