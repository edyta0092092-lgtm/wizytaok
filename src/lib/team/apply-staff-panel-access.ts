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

async function findInvitationByEmail(client: Client, businessId: string, email: string) {
  const em = email.trim().toLowerCase()
  const { data, error } = await client
    .from("business_invitations")
    .select("id, status, staff_member_id, email")
    .eq("business_id", businessId)
    .ilike("email", em)

  if (error) return { row: null as null, error: error.message }
  const row =
    data?.find((r) => (r.email ?? "").trim().toLowerCase() === em) ?? data?.[0] ?? null
  return { row, error: null as null }
}

async function readPendingToken(
  client: Client,
  businessId: string,
  staffMemberId: string,
  email: string,
): Promise<string | null> {
  const em = email.trim().toLowerCase()
  const { data: byStaff } = await client
    .from("business_invitations")
    .select("token")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .maybeSingle()

  if (byStaff?.token) return String(byStaff.token)

  const { data: byEmail } = await client
    .from("business_invitations")
    .select("token")
    .eq("business_id", businessId)
    .ilike("email", em)
    .eq("status", "pending")
    .maybeSingle()

  return byEmail?.token ? String(byEmail.token) : null
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

async function applyStaffPanelAccessDirect(
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

  const { data: business } = await client
    .from("business_profiles")
    .select("owner_id")
    .eq("id", businessId)
    .maybeSingle()

  if (business?.owner_id) {
    const { data: ownerMember } = await client
      .from("business_members")
      .select("id, email")
      .eq("business_id", businessId)
      .eq("user_id", business.owner_id)
      .maybeSingle()

    const ownerEmail = (ownerMember?.email ?? "").trim().toLowerCase()
    if (ownerEmail && ownerEmail === em) {
      return { ok: false, messageKey: "team.panelInviteOwnerEmail", detail: "owner_email" }
    }
  }

  let membersQuery = await client
    .from("business_members")
    .select("id, staff_member_id, user_id, email")
    .eq("business_id", businessId)
    .not("user_id", "is", null)

  if (membersQuery.error?.message?.toLowerCase().includes("is_active")) {
    membersQuery = await client
      .from("business_members")
      .select("id, staff_member_id, user_id, email")
      .eq("business_id", businessId)
      .not("user_id", "is", null)
  }

  const members = membersQuery.data ?? []
  const activeMemberForStaff = members.find((m) => m.staff_member_id === staffMemberId && m.user_id)
  if (activeMemberForStaff?.id) {
    await client
      .from("business_members")
      .update({
        role: form.panelMemberRole,
        email: em,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeMemberForStaff.id)

    const pendingTok = await readPendingToken(client, businessId, staffMemberId, em)
    return { ok: true, alreadyHasPanelAccess: true, invitationToken: pendingTok }
  }

  const otherActiveMemberWithEmail = members.find((m) => {
    if (!m.user_id || !m.staff_member_id) return false
    if (m.staff_member_id === staffMemberId) return false
    return (m.email ?? "").trim().toLowerCase() === em
  })
  if (otherActiveMemberWithEmail) {
    return { ok: false, messageKey: "team.panelInviteEmailConflict", detail: "email_conflict" }
  }

  await client
    .from("business_invitations")
    .update({ status: "cancelled" })
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")

  const { row: emailRow, error: emailLookupErr } = await findInvitationByEmail(client, businessId, em)
  if (emailLookupErr) {
    return { ok: false, messageKey: "invitations.invitationCreateError", detail: emailLookupErr }
  }

  if (
    emailRow?.status === "accepted" &&
    emailRow.staff_member_id &&
    emailRow.staff_member_id !== staffMemberId
  ) {
    const otherHasAccount = members.some(
      (m) => m.staff_member_id === emailRow.staff_member_id && m.user_id,
    )
    if (otherHasAccount) {
      return { ok: false, messageKey: "team.panelInviteEmailConflict", detail: "email_conflict" }
    }
  }

  const token = crypto.randomUUID()
  const invitationPatch = {
    status: "pending" as const,
    email: em,
    role: form.panelMemberRole,
    staff_member_id: staffMemberId,
    invited_by: invitedBy,
    token,
    accepted_at: null,
  }

  if (emailRow?.id) {
    const { error: updateErr } = await client
      .from("business_invitations")
      .update(invitationPatch)
      .eq("id", emailRow.id)
    if (updateErr) {
      return { ok: false, messageKey: "invitations.invitationCreateError", detail: updateErr.message }
    }
  } else {
    const { error: insertErr } = await client.from("business_invitations").insert({
      business_id: businessId,
      ...invitationPatch,
    })
    if (insertErr) {
      if (insertErr.code === "23505" || insertErr.message.toLowerCase().includes("duplicate")) {
        const { row: again } = await findInvitationByEmail(client, businessId, em)
        if (again?.id) {
          const { error: retryErr } = await client
            .from("business_invitations")
            .update(invitationPatch)
            .eq("id", again.id)
          if (retryErr) {
            return {
              ok: false,
              messageKey: "invitations.invitationCreateError",
              detail: retryErr.message,
            }
          }
        } else {
          return {
            ok: false,
            messageKey: "invitations.invitationCreateError",
            detail: insertErr.message,
          }
        }
      } else {
        return {
          ok: false,
          messageKey: "invitations.invitationCreateError",
          detail: insertErr.message,
        }
      }
    }
  }

  const verified = await readPendingToken(client, businessId, staffMemberId, em)
  if (!verified) {
    return {
      ok: false,
      messageKey: "invitations.invitationCreateError",
      detail: "invitation_not_persisted",
    }
  }

  return { ok: true, invitationToken: verified }
}

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
    default:
      return "invitations.invitationCreateError"
  }
}

async function applyStaffPanelAccessViaRpc(
  client: Client,
  businessId: string,
  staffMemberId: string,
  form: StaffPanelFormSlice,
  invitedBy: string | null,
): Promise<ApplyStaffPanelAccessResult | null> {
  const { data, error } = await client.rpc("upsert_staff_panel_invitation", {
    p_business_id: businessId,
    p_staff_member_id: staffMemberId,
    p_email: form.invitationEmail.trim().toLowerCase(),
    p_role: form.panelMemberRole,
    p_invited_by: invitedBy,
  })

  if (error) {
    const msg = error.message ?? ""
    if (
      msg.includes("upsert_staff_panel_invitation") &&
      (msg.includes("does not exist") || msg.includes("Could not find"))
    ) {
      return null
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

export async function applyStaffPanelAccess(
  client: Client,
  businessId: string,
  staffMemberId: string,
  form: StaffPanelFormSlice,
  invitedBy: string | null,
): Promise<ApplyStaffPanelAccessResult> {
  const direct = await applyStaffPanelAccessDirect(
    client,
    businessId,
    staffMemberId,
    form,
    invitedBy,
  )
  if (direct.ok) return direct
  if (direct.messageKey !== "invitations.invitationCreateError") return direct
  if (direct.detail !== "invitation_not_persisted") return direct

  const viaRpc = await applyStaffPanelAccessViaRpc(client, businessId, staffMemberId, form, invitedBy)
  if (viaRpc) return viaRpc

  return direct
}
