import type { PanelRole } from "@/lib/auth/permissions"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import {
  staffHasLinkedPanelAccount,
  syncBusinessMemberRoleForStaff,
  syncPendingInvitationRoleForStaff,
} from "@/lib/team/apply-staff-panel-access"

export type SyncStaffPanelRoleResult =
  | { ok: true; hasLinkedPanel: boolean; memberRoleUpdated: boolean }
  | { ok: false; error: string }

/** Synchronizacja roli panelu (service role) — działa także gdy brak staff_member_id w business_members. */
export async function syncStaffPanelRoleServer(
  businessId: string,
  staffMemberId: string,
  role: PanelRole,
  invitationEmail?: string,
): Promise<SyncStaffPanelRoleResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, error: "supabase_unconfigured" }
  }

  const bid = businessId.trim()
  const sid = staffMemberId.trim()
  if (!bid || !sid) {
    return { ok: false, error: "invalid_input" }
  }

  const email = invitationEmail?.trim() || undefined
  const hasLinkedPanel = await staffHasLinkedPanelAccount(admin, bid, sid, email)
  const memberSync = await syncBusinessMemberRoleForStaff(admin, bid, sid, role, email)
  if (!memberSync.ok) {
    return { ok: false, error: memberSync.detail ?? "member_role_sync_failed" }
  }

  const inviteSync = await syncPendingInvitationRoleForStaff(admin, bid, sid, role, email)
  if (!inviteSync.ok) {
    return { ok: false, error: inviteSync.detail ?? "invitation_role_sync_failed" }
  }

  return {
    ok: true,
    hasLinkedPanel,
    memberRoleUpdated: memberSync.updated,
  }
}
