import type { SupabaseClient } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccessFromProfile,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import {
  getCurrentUserRole,
  isAdminRole,
  normalizeBusinessMemberPanelRole,
  type PanelRole,
} from "@/lib/auth/permissions"
import { acceptPendingInvitationsForUser } from "@/lib/team/accept-pending-invitations"
import { isStaffInviteUser } from "@/lib/team/staff-invite-user"
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

type ProfileSubscriptionRow = {
  id: string
  subscription_status: string | null
  stripe_subscription_status: string | null
  subscription_trial_ends_at?: string | null
}

function readRpcSubscriptionRow(
  businessId: string,
  rpc: unknown,
): ProfileSubscriptionRow | null {
  if (!rpc || typeof rpc !== "object") return null
  const row = rpc as Record<string, unknown>
  if (row.ok !== true) return null
  return {
    id: businessId,
    subscription_status:
      typeof row.subscription_status === "string" ? row.subscription_status : null,
    stripe_subscription_status:
      typeof row.stripe_subscription_status === "string"
        ? row.stripe_subscription_status
        : null,
    subscription_trial_ends_at:
      typeof row.subscription_trial_ends_at === "string"
        ? row.subscription_trial_ends_at
        : null,
  }
}

async function loadProfileSubscription(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<ProfileSubscriptionRow | null> {
  let { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, subscription_status, stripe_subscription_status, subscription_trial_ends_at",
    )
    .eq("id", businessId)
    .maybeSingle()

  if (
    error?.message &&
    error.message.toLowerCase().includes("subscription_trial_ends_at")
  ) {
    const retry = await supabase
      .from("business_profiles")
      .select("id, subscription_status, stripe_subscription_status")
      .eq("id", businessId)
      .maybeSingle()
    data = retry.data ? { ...retry.data, subscription_trial_ends_at: null } : null
    error = retry.error
  }

  if (data?.id) return data

  const { data: rpc } = await supabase.rpc("get_business_member_subscription_access", {
    p_business_id: businessId,
  })
  return readRpcSubscriptionRow(businessId, rpc)
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

  let memberQuery = await supabase
    .from("business_members")
    .select("business_id, role")
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
      .select("business_id, role")
      .eq("user_id", userId)
      .limit(1)
  }

  let member = memberQuery.data?.[0]
  if (!member?.business_id && userEmail?.trim()) {
    await acceptPendingInvitationsForUser(userId, userEmail)
    let retryQuery = await supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
    if (
      retryQuery.error?.message &&
      retryQuery.error.message.toLowerCase().includes("is_active") &&
      retryQuery.error.message.toLowerCase().includes("does not exist")
    ) {
      retryQuery = await supabase
        .from("business_members")
        .select("business_id, role")
        .eq("user_id", userId)
        .limit(1)
    }
    member = retryQuery.data?.[0]
  }

  if (member?.business_id) {
    const panelRole = normalizeBusinessMemberPanelRole(member.role)
    const effectiveRole = getCurrentUserRole(false, panelRole)
    const canManageBilling = isAdminRole(effectiveRole)
    const profile = await loadProfileSubscription(supabase, member.business_id)
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
    .select("id, subscription_status, stripe_subscription_status")
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
