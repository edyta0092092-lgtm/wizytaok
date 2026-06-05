import type { SupabaseClient } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccessFromProfile,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import { loadBusinessMemberSubscription } from "@/lib/auth/load-business-member-subscription"
import {
  getCurrentUserRole,
  isAdminRole,
  normalizeBusinessMemberPanelRole,
  type PanelRole,
} from "@/lib/auth/permissions"
import { acceptPendingInvitationsForUser } from "@/lib/team/accept-pending-invitations"
import type { Database } from "@/types/database"

export type BusinessPanelAccess = {
  businessId: string | null
  subscriptionStatus: string | null
  hasActiveAccess: boolean
  isOwner: boolean
  panelRole: PanelRole | null
  effectiveRole: PanelRole | null
  /** Właściciel lub admin członka — może uruchomić checkout. */
  canManageBilling: boolean
}

type MemberRow = {
  business_id: string
  role: string | null
}

async function queryMembership(
  supabase: SupabaseClient<Database>,
  userId: string,
  activeOnly: boolean,
): Promise<MemberRow | null> {
  let query = supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId)
    .limit(1)

  if (activeOnly) {
    query = query.eq("is_active", true)
  }

  const { data, error } = await query

  if (
    activeOnly &&
    error?.message &&
    error.message.toLowerCase().includes("is_active") &&
    error.message.toLowerCase().includes("does not exist")
  ) {
    return queryMembership(supabase, userId, false)
  }

  return data?.[0] ?? null
}

async function findMembershipForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  userEmail?: string | null,
): Promise<MemberRow | null> {
  let member = await queryMembership(supabase, userId, true)
  if (!member?.business_id) {
    member = await queryMembership(supabase, userId, false)
  }

  if (!member?.business_id && userEmail?.trim()) {
    await acceptPendingInvitationsForUser(userId, userEmail)
    member = await queryMembership(supabase, userId, true)
    if (!member?.business_id) {
      member = await queryMembership(supabase, userId, false)
    }
  }

  return member
}

/**
 * Określa dostęp użytkownika do operacyjnego panelu na podstawie subskrypcji firmy.
 * Używane w middleware (sesja użytkownika + RLS).
 */
export async function resolveBusinessPanelAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  userEmail?: string | null,
  options?: { staffInvite?: boolean },
): Promise<BusinessPanelAccess> {
  const empty: BusinessPanelAccess = {
    businessId: null,
    subscriptionStatus: null,
    hasActiveAccess: false,
    isOwner: false,
    panelRole: null,
    effectiveRole: null,
    canManageBilling: false,
  }

  const member = await findMembershipForUser(supabase, userId, userEmail)

  if (member?.business_id) {
    const panelRole = normalizeBusinessMemberPanelRole(member.role)
    const effectiveRole = getCurrentUserRole(false, panelRole)
    const canManageBilling = isAdminRole(effectiveRole)
    const profile = await loadBusinessMemberSubscription(
      supabase,
      userId,
      member.business_id,
    )
    if (!profile) {
      return {
        ...empty,
        businessId: member.business_id,
        panelRole,
        effectiveRole,
        canManageBilling,
      }
    }
    const subscriptionStatus = resolveEffectiveSubscriptionStatus(
      profile.subscription_status,
      profile.stripe_subscription_status,
    )
    return {
      businessId: profile.id,
      subscriptionStatus,
      hasActiveAccess: hasActiveBusinessAccessFromProfile({
        subscriptionStatus: profile.subscription_status,
        stripeSubscriptionStatus: profile.stripe_subscription_status,
        subscriptionTrialEndsAt: profile.subscription_trial_ends_at,
        trialStartedAt: profile.trial_started_at,
        stripeSubscriptionId: profile.stripe_subscription_id,
      }),
      isOwner: false,
      panelRole,
      effectiveRole,
      canManageBilling,
    }
  }

  const staffInvite = options?.staffInvite === true
  if (!staffInvite) {
    try {
      await supabase.rpc("ensure_owner_membership")
    } catch {
      // RPC może być niedostępne w starszej bazie — kontynuujemy odczyt profilu.
    }
  }

  const { data: owned } = await supabase
    .from("business_profiles")
    .select(
      "id, subscription_status, stripe_subscription_status, subscription_trial_ends_at, trial_started_at, stripe_subscription_id",
    )
    .eq("owner_id", userId)
    .maybeSingle()

  if (owned?.id && !staffInvite) {
    const subscriptionStatus = resolveEffectiveSubscriptionStatus(
      owned.subscription_status,
      owned.stripe_subscription_status,
    )
    const effectiveRole: PanelRole = "admin"
    return {
      businessId: owned.id,
      subscriptionStatus,
      hasActiveAccess: hasActiveBusinessAccessFromProfile({
        subscriptionStatus: owned.subscription_status,
        stripeSubscriptionStatus: owned.stripe_subscription_status,
        subscriptionTrialEndsAt: owned.subscription_trial_ends_at,
        trialStartedAt: owned.trial_started_at,
        stripeSubscriptionId: owned.stripe_subscription_id,
      }),
      isOwner: true,
      panelRole: effectiveRole,
      effectiveRole,
      canManageBilling: true,
    }
  }

  return empty
}

export function billingRecoveryRedirectPath(
  access: BusinessPanelAccess,
  _options?: { staffInvite?: boolean },
): string {
  if (!access.businessId) {
    return "/settings?setup=business"
  }
  if (!access.canManageBilling) {
    return "/subscription-required"
  }
  return "/activate-access"
}
