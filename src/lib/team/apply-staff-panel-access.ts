import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import type { PanelRole } from "@/lib/auth/permissions"

type Client = SupabaseClient<Database>

export type StaffPanelFormSlice = {
  panelMemberRole: PanelRole
  invitationEmail: string
}

async function fetchPendingInviteToken(
  client: Client,
  businessId: string,
  staffMemberId: string,
): Promise<string | null> {
  const { data } = await client
    .from("business_invitations")
    .select("token")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .maybeSingle()
  const tok = data?.token
  return typeof tok === "string" && tok.length > 0 ? tok : null
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

export type ApplyStaffPanelAccessResult =
  | { ok: true; invitationToken: string | null; alreadyHasPanelAccess?: boolean }
  | { ok: false; messageKey: string; detail?: string }

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

  const { data: memberRow } = await client
    .from("business_members")
    .select("id, user_id")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .maybeSingle()

  if (memberRow?.user_id) {
    await client
      .from("business_invitations")
      .update({ status: "cancelled" })
      .eq("business_id", businessId)
      .eq("staff_member_id", staffMemberId)
      .eq("status", "pending")
    const { error } = await client
      .from("business_members")
      .update({
        role: form.panelMemberRole,
        email: em,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberRow.id)
    if (error) {
      return { ok: false, messageKey: "invitations.invitationCreateError", detail: error.message }
    }
    const pendingTok = await fetchPendingInviteToken(client, businessId, staffMemberId)
    if (pendingTok) {
      return { ok: true, invitationToken: pendingTok }
    }
    return { ok: true, invitationToken: null, alreadyHasPanelAccess: true }
  }

  await client
    .from("business_invitations")
    .update({ status: "cancelled" })
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")

  const { data: emailRows, error: emailLookupErr } = await client
    .from("business_invitations")
    .select("id, status, staff_member_id, email")
    .eq("business_id", businessId)
    .ilike("email", em)

  if (emailLookupErr) {
    return { ok: false, messageKey: "invitations.invitationCreateError", detail: emailLookupErr.message }
  }

  const emailRow =
    emailRows?.find((row) => (row.email ?? "").trim().toLowerCase() === em) ?? emailRows?.[0] ?? null

  if (emailRow?.status === "accepted") {
    const linkedStaffId = emailRow.staff_member_id
    if (linkedStaffId === staffMemberId) {
      return { ok: true, invitationToken: null, alreadyHasPanelAccess: true }
    }
    if (linkedStaffId && linkedStaffId !== staffMemberId) {
      return { ok: false, messageKey: "team.panelInviteEmailConflict" }
    }
    const token = crypto.randomUUID()
    const { error: reopenErr } = await client
      .from("business_invitations")
      .update({
        status: "pending",
        email: em,
        role: form.panelMemberRole,
        staff_member_id: staffMemberId,
        invited_by: invitedBy,
        token,
        accepted_at: null,
      })
      .eq("id", emailRow.id)
    if (reopenErr) {
      return { ok: false, messageKey: "invitations.invitationCreateError", detail: reopenErr.message }
    }
    return { ok: true, invitationToken: token }
  }
  if (
    emailRow?.status === "pending" &&
    emailRow.staff_member_id &&
    emailRow.staff_member_id !== staffMemberId
  ) {
    return { ok: false, messageKey: "team.panelInviteEmailConflict" }
  }

  const token = crypto.randomUUID()

  if (
    emailRow &&
    (emailRow.status === "pending" || emailRow.status === "cancelled") &&
    emailRow.id
  ) {
    const { error } = await client
      .from("business_invitations")
      .update({
        status: "pending",
        email: em,
        role: form.panelMemberRole,
        staff_member_id: staffMemberId,
        invited_by: invitedBy,
        token,
      })
      .eq("id", emailRow.id)
    if (error) {
      return { ok: false, messageKey: "invitations.invitationCreateError", detail: error.message }
    }
    return { ok: true, invitationToken: token }
  }

  const { data: inserted, error } = await client
    .from("business_invitations")
    .insert({
      business_id: businessId,
      email: em,
      role: form.panelMemberRole,
      staff_member_id: staffMemberId,
      invited_by: invitedBy,
      token,
      status: "pending",
    })
    .select("token")
    .single()

  if (!error && inserted?.token) {
    return { ok: true, invitationToken: String(inserted.token) }
  }

  if (error?.code === "23505" || error?.message?.toLowerCase().includes("duplicate")) {
    const { data: existing } = await client
      .from("business_invitations")
      .select("id, status, staff_member_id")
      .eq("business_id", businessId)
      .ilike("email", em)
      .maybeSingle()
    if (
      existing?.id &&
      (existing.status === "pending" || existing.status === "cancelled")
    ) {
      const { error: retryErr } = await client
        .from("business_invitations")
        .update({
          status: "pending",
          email: em,
          role: form.panelMemberRole,
          staff_member_id: staffMemberId,
          invited_by: invitedBy,
          token,
        })
        .eq("id", existing.id)
      if (!retryErr) {
        return { ok: true, invitationToken: token }
      }
      return {
        ok: false,
        messageKey: "invitations.invitationCreateError",
        detail: retryErr.message,
      }
    }
  }

  if (error) {
    return { ok: false, messageKey: "invitations.invitationCreateError", detail: error.message }
  }

  const insertedTok = await fetchPendingInviteToken(client, businessId, staffMemberId)
  return { ok: true, invitationToken: insertedTok }
}
