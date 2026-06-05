import type { SupabaseClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { evaluateTrialStartEligibility } from "@/lib/billing/trial-eligibility-server"
import { isClientAccountUser } from "@/lib/client-portal/client-portal-auth"
import { safeInternalRedirect } from "@/lib/auth/safe-internal-redirect"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { acceptPendingInvitationsForUser } from "@/lib/team/accept-pending-invitations"
import { isStaffInviteUser } from "@/lib/team/staff-invite-user"
import type { Database } from "@/types/database"

const BUSINESS_SETUP_PATH = "/settings?setup=business"

async function readMemberBusinessId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  let memberQuery = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
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
      .eq("user_id", userId)
      .limit(1)
  }

  return memberQuery.data?.[0]?.business_id ?? null
}

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

  if (isClientAccountUser(user)) {
    if (requestedNext?.startsWith("/konto")) return requestedNext
    return "/konto"
  }

  if (requestedNext?.startsWith("/konto")) {
    return "/konto/logowanie"
  }

  let memberBusinessId = await readMemberBusinessId(supabase, user.id)
  if (!memberBusinessId) {
    await acceptPendingInvitationsForUser(user.id, email)
    memberBusinessId = await readMemberBusinessId(supabase, user.id)
  }
  if (memberBusinessId) {
    return requestedNext ?? "/dashboard"
  }

  const staffInvite = isStaffInviteUser(user)
  const { data: owned } = await supabase
    .from("business_profiles")
    .select("id, subscription_status, stripe_subscription_status")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (owned?.id && !staffInvite) {
    const status = resolveEffectiveSubscriptionStatus(
      owned.subscription_status,
      owned.stripe_subscription_status,
    )
    const wantsTrial =
      Boolean(options?.trialFromCookie) ||
      userWantsTrial(user) ||
      requestedNext === "/start-trial"
    if (wantsTrial && !hasActiveBusinessAccess(status)) {
      const admin = getServiceRoleClient()
      if (admin) {
        const { data: fullProfile } = await admin
          .from("business_profiles")
          .select("*")
          .eq("id", owned.id)
          .maybeSingle()
        if (fullProfile) {
          const eligibility = await evaluateTrialStartEligibility(admin, {
            userId: user.id,
            userEmail: email,
            businessProfile: fullProfile,
          })
          if (!eligibility.blocked) {
            return "/start-trial"
          }
        }
      }
      return "/activate-access?trial_blocked=1"
    }
    if (requestedNext && requestedNext !== "/dashboard") {
      return requestedNext
    }
    return "/dashboard"
  }

  if (staffInvite) {
    return requestedNext?.includes("setup=business") ? "/dashboard" : requestedNext ?? "/dashboard"
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
  if (next?.startsWith("/konto")) {
    return "/konto/logowanie"
  }
  if (next?.startsWith("/signup")) {
    return "/signup"
  }
  return "/login"
}
