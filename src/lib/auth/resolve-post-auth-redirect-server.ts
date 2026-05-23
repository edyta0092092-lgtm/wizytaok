import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { safeInternalRedirect } from "@/lib/auth/safe-internal-redirect"
import type { Database } from "@/types/database"

const BUSINESS_SETUP_PATH = "/settings?setup=business"

function userWantsTrial(user: User): boolean {
  const raw = user.user_metadata?.trial_intent
  return raw === true || raw === "true" || raw === 1 || raw === "1"
}

/**
 * Po OAuth / magic link / e-mail confirm: nie wpuszczaj do panelu bez profilu firmy lub członkostwa.
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient<Database>,
  requestedNextRaw: string | null | undefined,
  options?: { trialFromCookie?: boolean },
): Promise<string> {
  const requestedNext = safeInternalRedirect(requestedNextRaw)

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return "/login"
  }

  const email = user.email?.trim()
  if (!email) {
    return `${BUSINESS_SETUP_PATH}&oauth_warning=no_email`
  }

  const { data: owned } = await supabase
    .from("business_profiles")
    .select("id, subscription_status, stripe_subscription_status")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (owned?.id) {
    const status = resolveEffectiveSubscriptionStatus(
      owned.subscription_status,
      owned.stripe_subscription_status,
    )
    const wantsTrial =
      Boolean(options?.trialFromCookie) ||
      userWantsTrial(user) ||
      requestedNext === "/start-trial"
    if (wantsTrial && !hasActiveBusinessAccess(status)) {
      return "/start-trial"
    }
    if (requestedNext && requestedNext !== "/dashboard") {
      return requestedNext
    }
    return "/dashboard"
  }

  let memberQuery = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)

  if (
    memberQuery.error?.message &&
    memberQuery.error.message.toLowerCase().includes("is_active") &&
    memberQuery.error.message.toLowerCase().includes("does not exist")
  ) {
    memberQuery = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", user.id)
      .limit(1)
  }

  const memberBusinessId = memberQuery.data?.[0]?.business_id
  if (memberBusinessId) {
    return requestedNext ?? "/dashboard"
  }

  if (requestedNext?.includes("setup=business")) {
    return requestedNext
  }
  if (requestedNext === "/start-trial") {
    return BUSINESS_SETUP_PATH
  }
  return BUSINESS_SETUP_PATH
}

export function oauthErrorReturnPath(requestedNextRaw: string | null | undefined): string {
  const next = safeInternalRedirect(requestedNextRaw)
  if (next?.startsWith("/signup")) {
    return "/signup"
  }
  return "/login"
}
