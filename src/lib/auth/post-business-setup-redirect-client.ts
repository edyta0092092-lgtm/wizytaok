import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { fetchTrialStartEligibility } from "@/lib/billing/trial-eligibility-client"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export function readTrialIntentFromBrowser(userMetadata?: Record<string, unknown>): boolean {
  const raw = userMetadata?.trial_intent
  const fromMeta =
    raw === true || raw === "true" || raw === 1 || raw === "1"
  if (fromMeta) return true
  if (typeof document !== "undefined" && document.cookie.includes("wizytaok_trial_intent=1")) {
    return true
  }
  if (typeof window !== "undefined") {
    try {
      return window.localStorage.getItem("wizytaok_trial_intent") === "1"
    } catch {
      return false
    }
  }
  return false
}

export function clearTrialIntentMarkers(): void {
  try {
    document.cookie = "wizytaok_trial_intent=; Max-Age=0; Path=/; SameSite=Lax"
    window.localStorage.removeItem("wizytaok_trial_intent")
  } catch {
    /* ignore */
  }
}

/**
 * Po uzupełnieniu profilu firmy (OAuth setup): trial / paywall / panel.
 */
export async function resolvePathAfterBusinessSetup(
  userMetadata?: Record<string, unknown>,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    return "/activate-access"
  }
  const client = getBrowserClient()
  if (!client) {
    return "/activate-access"
  }

  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) {
    return "/login"
  }

  const { data: profile } = await client
    .from("business_profiles")
    .select("subscription_status, stripe_subscription_status")
    .eq("owner_id", user.id)
    .maybeSingle()

  const status = resolveEffectiveSubscriptionStatus(
    profile?.subscription_status ?? null,
    profile?.stripe_subscription_status ?? null,
  )

  if (hasActiveBusinessAccess(status)) {
    clearTrialIntentMarkers()
    return "/dashboard"
  }

  const wantsTrial = readTrialIntentFromBrowser(userMetadata ?? user.user_metadata ?? undefined)
  if (wantsTrial) {
    const eligibility = await fetchTrialStartEligibility()
    clearTrialIntentMarkers()
    if (eligibility.blocked) {
      return "/activate-access?trial_blocked=1"
    }
    return "/start-trial"
  }

  return "/activate-access"
}
