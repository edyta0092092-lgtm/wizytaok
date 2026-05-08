/**
 * Uprawnienia panelu na podstawie roli w firmie (admin / staff).
 * Źródło prawdy: Supabase `business_members` + właściciel `business_profiles.owner_id`.
 */

export type PanelRole = "admin" | "staff"

/** Mapowanie roli z `business_members.role` na rolę panelu (obsługa synonimów). */
export function normalizeBusinessMemberPanelRole(raw: string | null | undefined): PanelRole {
  const n = String(raw ?? "").trim().toLowerCase()
  if (n === "admin" || n === "administrator" || n === "owner") return "admin"
  return "staff"
}

export type BusinessMembershipInfo = {
  businessId: string | null
  role: PanelRole | null
  isOwner: boolean
}

export function getCurrentBusinessMembership(input: {
  businessId: string | null
  panelRole: PanelRole | null
  isOwner: boolean
}): BusinessMembershipInfo {
  return {
    businessId: input.businessId,
    isOwner: input.isOwner,
    role: getCurrentUserRole(input.isOwner, input.panelRole),
  }
}

/** Alias nazewnictwa zgodny ze specyfikacją. */
export function getCurrentMembership(input: {
  businessId: string | null
  panelRole: PanelRole | null
  isOwner: boolean
}): BusinessMembershipInfo {
  return getCurrentBusinessMembership(input)
}

export function getCurrentUserRole(isOwner: boolean, memberRole: PanelRole | null): PanelRole | null {
  if (isOwner) return "admin"
  return memberRole
}

/** Aktualna rola w firmie: `admin` | `staff` lub null bez członkostwa (z wyłączeniem właściciela jako admin). */
export function getCurrentUserBusinessRole(
  isOwner: boolean,
  memberRole: PanelRole | null,
): PanelRole | null {
  return getCurrentUserRole(isOwner, memberRole)
}

export function getCurrentPanelRole(isOwner: boolean, memberRole: PanelRole | null): PanelRole | null {
  return getCurrentUserRole(isOwner, memberRole)
}

export function isAdminRole(role: PanelRole | null): boolean {
  return role === "admin"
}

export function isStaffRole(role: PanelRole | null): boolean {
  return role === "staff"
}

export function isPanelOwner(role: PanelRole | null): boolean {
  return role === "admin"
}

export function isStaffUser(role: PanelRole | null): boolean {
  return role === "staff"
}

export function canManageSettings(role: PanelRole | null): boolean {
  return role === "admin"
}

/** Język i motyw w panelu (obsługa + administrator). */
export function canCustomizeAppearancePreferences(role: PanelRole | null): boolean {
  return role === "admin" || role === "staff"
}

export function canManageBusinessSettings(role: PanelRole | null): boolean {
  return canManageSettings(role)
}

export function canManageServices(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageAvailability(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageTeam(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageDeposits(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageReminders(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageReminderSettings(role: PanelRole | null): boolean {
  return canManageReminders(role)
}

export function canManageBookings(role: PanelRole | null): boolean {
  return role === "admin" || role === "staff"
}

/** Trwałe usunięcie wizyty z bazy / lokalnych zapisów — tylko administrator (właściciel liczy się jako admin). */
export function canDeleteBookings(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageClients(role: PanelRole | null): boolean {
  return role === "admin" || role === "staff"
}

export function canSendReminders(role: PanelRole | null): boolean {
  return role === "admin" || role === "staff"
}

/** Konfiguracja szablonów / wysyłek (tylko administrator). Obsługa ma tylko podgląd historii. */
export function canSendMessages(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canManageMessageTemplates(role: PanelRole | null): boolean {
  return role === "admin"
}

/** Dostęp do modułu Wiadomości tylko dla administratora/właściciela. */
export function canAccessMessages(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canViewMessageSendHistory(role: PanelRole | null): boolean {
  return canAccessMessages(role)
}

export function canManageInvitations(role: PanelRole | null): boolean {
  return role === "admin"
}

export function canInviteUsers(role: PanelRole | null): boolean {
  return canManageInvitations(role)
}
