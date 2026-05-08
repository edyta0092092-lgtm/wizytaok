"use client"

import * as React from "react"

import {
  canCustomizeAppearancePreferences,
  canDeleteBookings,
  canInviteUsers,
  canManageAvailability,
  canManageBookings,
  canManageBusinessSettings,
  canManageClients,
  canManageDeposits,
  canManageInvitations,
  canManageMessageTemplates,
  canManageReminderSettings,
  canManageReminders,
  canManageServices,
  canManageSettings,
  canManageTeam,
  canSendMessages,
  canSendReminders,
  canViewMessageSendHistory,
  getCurrentBusinessMembership,
  getCurrentUserRole,
  normalizeBusinessMemberPanelRole,
  type PanelRole,
} from "@/lib/auth/permissions"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export type BusinessAccessState = {
  ready: boolean
  businessId: string | null
  isOwner: boolean
  panelRole: PanelRole | null
  displayName: string | null
  userEmail: string | null
}

export type BusinessAccessContextValue = BusinessAccessState & {
  effectiveRole: PanelRole | null
  membership: ReturnType<typeof getCurrentBusinessMembership>
  refresh: () => Promise<void>
  canManageSettings: boolean
  canManageBusinessSettings: boolean
  canCustomizeAppearancePreferences: boolean
  canManageServices: boolean
  canManageAvailability: boolean
  canManageTeam: boolean
  canManageDeposits: boolean
  canManageReminders: boolean
  canManageReminderSettings: boolean
  canManageBookings: boolean
  canDeleteBookings: boolean
  canManageClients: boolean
  canSendReminders: boolean
  canSendMessages: boolean
  canManageInvitations: boolean
  canInviteUsers: boolean
  canManageMessageTemplates: boolean
  canViewMessageSendHistory: boolean
}

const defaultState: BusinessAccessState = {
  ready: false,
  businessId: null,
  isOwner: false,
  panelRole: null,
  displayName: null,
  userEmail: null,
}

const BusinessAccessContext = React.createContext<BusinessAccessContextValue | null>(null)

async function loadAccessState(): Promise<BusinessAccessState> {
  if (!isSupabaseConfigured()) {
    return {
      ready: true,
      businessId: null,
      isOwner: true,
      panelRole: "admin",
      displayName: null,
      userEmail: null,
    }
  }
  const client = getBrowserClient()
  if (!client) {
    return { ...defaultState, ready: true, panelRole: "admin" }
  }
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) {
    return { ...defaultState, ready: true }
  }
  await client.rpc("ensure_owner_membership")
  const { data: owned } = await client
    .from("business_profiles")
    .select("id, business_name, owner_name")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (owned?.id) {
    const label =
      (typeof owned.owner_name === "string" && owned.owner_name.trim()
        ? owned.owner_name.trim()
        : null) ?? owned.business_name
    return {
      ready: true,
      businessId: owned.id,
      isOwner: true,
      panelRole: "admin",
      displayName: label,
      userEmail: user.email ?? null,
    }
  }
  let memberQuery = await client
    .from("business_members")
    .select("business_id, role, display_name, email")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
  if (
    memberQuery.error?.message &&
    memberQuery.error.message.toLowerCase().includes("is_active") &&
    memberQuery.error.message.toLowerCase().includes("does not exist")
  ) {
    memberQuery = await client
      .from("business_members")
      .select("business_id, role, display_name, email")
      .eq("user_id", user.id)
      .limit(1)
  }
  const member = memberQuery.data?.[0]
  if (!member?.business_id) {
    return {
      ready: true,
      businessId: null,
      isOwner: false,
      panelRole: null,
      displayName: null,
      userEmail: user.email ?? null,
    }
  }
  const r = normalizeBusinessMemberPanelRole(member.role)
  return {
    ready: true,
    businessId: member.business_id,
    isOwner: false,
    panelRole: r,
    displayName: member.display_name?.trim() || member.email || user.email || null,
    userEmail: user.email ?? null,
  }
}

function buildPermissions(role: PanelRole | null) {
  return {
    canManageSettings: canManageSettings(role),
    canCustomizeAppearancePreferences: canCustomizeAppearancePreferences(role),
    canManageBusinessSettings: canManageBusinessSettings(role),
    canManageServices: canManageServices(role),
    canManageAvailability: canManageAvailability(role),
    canManageTeam: canManageTeam(role),
    canManageDeposits: canManageDeposits(role),
    canManageReminders: canManageReminders(role),
    canManageReminderSettings: canManageReminderSettings(role),
    canManageBookings: canManageBookings(role),
    canDeleteBookings: canDeleteBookings(role),
    canManageClients: canManageClients(role),
    canSendReminders: canSendReminders(role),
    canSendMessages: canSendMessages(role),
    canManageMessageTemplates: canManageMessageTemplates(role),
    canViewMessageSendHistory: canViewMessageSendHistory(role),
    canManageInvitations: canManageInvitations(role),
    canInviteUsers: canInviteUsers(role),
  }
}

function mergeValue(
  state: BusinessAccessState,
  refresh: () => Promise<void>,
): BusinessAccessContextValue {
  const effectiveRole = getCurrentUserRole(state.isOwner, state.panelRole)
  const membership = getCurrentBusinessMembership({
    businessId: state.businessId,
    panelRole: state.panelRole,
    isOwner: state.isOwner,
  })
  return {
    ...state,
    effectiveRole,
    membership,
    refresh,
    ...buildPermissions(effectiveRole),
  }
}

export function BusinessAccessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<BusinessAccessState>(defaultState)

  const refresh = React.useCallback(async () => {
    const next = await loadAccessState()
    setState(next)
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) return
    const { data } = client.auth.onAuthStateChange(() => {
      void refresh()
    })
    return () => {
      data.subscription.unsubscribe()
    }
  }, [refresh])

  const value = React.useMemo(() => mergeValue(state, refresh), [state, refresh])

  return <BusinessAccessContext.Provider value={value}>{children}</BusinessAccessContext.Provider>
}

export function useBusinessAccess(): BusinessAccessContextValue {
  const ctx = React.useContext(BusinessAccessContext)
  if (!ctx) {
    throw new Error("useBusinessAccess must be used within BusinessAccessProvider")
  }
  return ctx
}
