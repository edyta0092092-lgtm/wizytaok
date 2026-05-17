import type { SupabaseClient } from "@supabase/supabase-js"

import {
  hasActiveBusinessAccess,
  resolveEffectiveSubscriptionStatus,
} from "@/lib/billing/subscription-status"
import {
  getCurrentUserRole,
  isAdminRole,
  normalizeBusinessMemberPanelRole,
  type PanelRole,
} from "@/lib/auth/permissions"
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
}

async function loadProfileSubscription(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<ProfileSubscriptionRow | null> {
  const { data } = await supabase
    .from("business_profiles")
    .select("id, subscription_status, stripe_subscription_status")
    .eq("id", businessId)
    .maybeSingle()
  return data ?? null
}

/**
 * Określa dostęp użytkownika do operacyjnego panelu na podstawie subskrypcji firmy.
 * Używane w middleware (sesja użytkownika + RLS).
 */
export async function resolveBusinessPanelAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
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

  try {
    await supabase.rpc("ensure_owner_membership")
  } catch {
    // RPC może być niedostępne w starszej bazie — kontynuujemy odczyt profilu.
  }

  const { data: owned } = await supabase
    .from("business_profiles")
    .select("id, subscription_status, stripe_subscription_status")
    .eq("owner_id", userId)
    .maybeSingle()

  if (owned?.id) {
    const subscriptionStatus = resolveEffectiveSubscriptionStatus(
      owned.subscription_status,
      owned.stripe_subscription_status,
    )
    const effectiveRole: PanelRole = "admin"
    return {
      businessId: owned.id,
      subscriptionStatus,
      hasActiveAccess: hasActiveBusinessAccess(subscriptionStatus),
      isOwner: true,
      panelRole: effectiveRole,
      effectiveRole,
      canManageBilling: true,
    }
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

  const member = memberQuery.data?.[0]
  if (!member?.business_id) {
    return empty
  }

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
    hasActiveAccess: hasActiveBusinessAccess(subscriptionStatus),
    isOwner: false,
    panelRole,
    effectiveRole,
    canManageBilling,
  }
}

export function billingRecoveryRedirectPath(access: BusinessPanelAccess): string {
  if (!access.businessId) {
    return "/settings?setup=business"
  }
  if (!access.canManageBilling) {
    return "/subscription-required"
  }
  return "/settings?billing=required"
}
