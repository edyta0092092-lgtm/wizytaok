import { cookies } from "next/headers"
import type { User } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { evaluateTrialStartEligibility } from "@/lib/billing/trial-eligibility-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

function userWantsTrial(user: User): boolean {
  const raw = user.user_metadata?.trial_intent
  return raw === true || raw === "true" || raw === 1 || raw === "1"
}

async function readTrialIntentFromCookies(): Promise<boolean> {
  try {
    const store = await cookies()
    return store.get("wizytaok_trial_intent")?.value === "1"
  } catch {
    return false
  }
}

function paidCheckoutPath(params?: Record<string, string>): string {
  const qs = new URLSearchParams({ auto: "paid", ...(params ?? {}) })
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
    return paidCheckoutPath()
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
    return paidCheckoutPath()
  }

  const wantsTrial = (await readTrialIntentFromCookies()) || userWantsTrial(user)
  const eligibility = await evaluateTrialStartEligibility(admin, {
    userId: user.id,
    userEmail: user.email,
    businessProfile: row,
  })

  if (eligibility.blocked) {
    return paidCheckoutPath({ trial_blocked: "1" })
  }

  return wantsTrial ? "/start-trial" : paidCheckoutPath()
}
