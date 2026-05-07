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

export async function applyStaffPanelAccess(
  client: Client,
  businessId: string,
  staffMemberId: string,
  form: StaffPanelFormSlice,
  invitedBy: string | null,
): Promise<{ ok: true; invitationToken: string | null } | { ok: false; messageKey: string }> {
  const em = form.invitationEmail.trim().toLowerCase()
  if (!em) {
    return { ok: false, messageKey: "team.panelEmailRequired" }
  }

  const { data: memberRow } = await client
    .from("business_members")
    .select("id")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .maybeSingle()

  if (memberRow) {
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
    if (error) return { ok: false, messageKey: "invitations.invitationCreateError" }
    const pendingTok = await fetchPendingInviteToken(client, businessId, staffMemberId)
    return { ok: true, invitationToken: pendingTok }
  }

  await client
    .from("business_invitations")
    .update({ status: "cancelled" })
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")

  const { data: emailRow } = await client
    .from("business_invitations")
    .select("id, status, staff_member_id")
    .eq("business_id", businessId)
    .eq("email", em)
    .maybeSingle()

  if (emailRow?.status === "accepted") {
    return { ok: false, messageKey: "team.panelInviteEmailConflict" }
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
        role: form.panelMemberRole,
        staff_member_id: staffMemberId,
        invited_by: invitedBy,
        token,
      })
      .eq("id", emailRow.id)
    if (error) return { ok: false, messageKey: "invitations.invitationCreateError" }
    return { ok: true, invitationToken: token }
  }

  const { error } = await client.from("business_invitations").insert({
    business_id: businessId,
    email: em,
    role: form.panelMemberRole,
    staff_member_id: staffMemberId,
    invited_by: invitedBy,
  })

  if (error) return { ok: false, messageKey: "invitations.invitationCreateError" }
  const insertedTok = await fetchPendingInviteToken(client, businessId, staffMemberId)
  return { ok: true, invitationToken: insertedTok }
}
