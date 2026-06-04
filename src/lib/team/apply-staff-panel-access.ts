import type { SupabaseClient } from "@supabase/supabase-js"

import type { PanelRole } from "@/lib/auth/permissions"

type Client = SupabaseClient

export type StaffPanelFormSlice = {
  panelMemberRole: PanelRole
  invitationEmail: string
}

export type ApplyStaffPanelAccessResult =
  | { ok: true; invitationToken: string }
  | { ok: true; alreadyHasPanelAccess: true; invitationToken?: string | null }
  | { ok: false; messageKey: string; detail?: string }

type RpcUpsertResult = {
  ok?: boolean
  token?: string | null
  already_has_access?: boolean
  code?: string
  detail?: string
}

function mapRpcCodeToMessageKey(code: string | undefined): string {
  switch (code) {
    case "email_required":
      return "team.panelEmailRequired"
    case "email_conflict":
      return "team.panelInviteEmailConflict"
    case "owner_email":
      return "team.panelInviteOwnerEmail"
    case "invalid_role":
    case "not_persisted":
    case "db_error":
    default:
      return "invitations.invitationCreateError"
  }
}

/** Uaktualnia rolę panelu przy istniejącym powiązaniu biznes‑członkostwo ↔ staff (bez wymuszania zaproszenia). */
export async function syncBusinessMemberRoleForStaff(
  client: Client,
  businessId: string,
  staffMemberId: string,
  role: PanelRole,
): Promise<{ ok: boolean; detail?: string }> {
  const { data: memberRow } = await client
    .from("business_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .maybeSingle()
  if (!memberRow?.id) return { ok: true }
  const { error } = await client
    .from("business_members")
    .update({
      role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", memberRow.id)
  if (error) return { ok: false, detail: error.message }
  return { ok: true }
}

export async function applyStaffPanelAccess(
  client: Client,
  businessId: string,
  staffMemberId: string,
  form: StaffPanelFormSlice,
  invitedBy: string | null,
): Promise<ApplyStaffPanelAccessResult> {
  const em = form.invitationEmail.trim().toLowerCase()
  if (!em) {
    return { ok: false, messageKey: "team.panelEmailRequired" }
  }

  const { data, error } = await client.rpc("upsert_staff_panel_invitation", {
    p_business_id: businessId,
    p_staff_member_id: staffMemberId,
    p_email: em,
    p_role: form.panelMemberRole,
    p_invited_by: invitedBy,
  })

  if (error) {
    const msg = error.message ?? ""
    if (
      msg.includes("upsert_staff_panel_invitation") &&
      (msg.includes("does not exist") || msg.includes("Could not find"))
    ) {
      return {
        ok: false,
        messageKey: "team.migration082Required",
        detail: "migration_082_required",
      }
    }
    return { ok: false, messageKey: "invitations.invitationCreateError", detail: msg }
  }

  const payload = (data ?? null) as RpcUpsertResult | null
  if (!payload || payload.ok !== true) {
    const code = typeof payload?.code === "string" ? payload.code : "unknown"
    const detail =
      typeof payload?.detail === "string" && payload.detail.trim()
        ? payload.detail.trim()
        : code
    return {
      ok: false,
      messageKey: mapRpcCodeToMessageKey(code),
      detail,
    }
  }

  if (payload.already_has_access === true) {
    const tok =
      typeof payload.token === "string" && payload.token.length > 0 ? payload.token : null
    return { ok: true, alreadyHasPanelAccess: true, invitationToken: tok }
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : ""
  if (!token) {
    return {
      ok: false,
      messageKey: "invitations.invitationCreateError",
      detail: "invitation_token_missing",
    }
  }

  return { ok: true, invitationToken: token }
}
