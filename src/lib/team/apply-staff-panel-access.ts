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

async function resolveOwnerAuthEmail(client: Client, ownerId: string): Promise<string | null> {
  const { data, error } = await client.auth.admin.getUserById(ownerId)
  if (error || !data?.user?.email?.trim()) return null
  return data.user.email.trim().toLowerCase()
}

async function findInvitationByEmail(client: Client, businessId: string, email: string) {
  const em = email.trim().toLowerCase()
  const { data, error } = await client
    .from("business_invitations")
    .select("id, status, staff_member_id, email")
    .eq("business_id", businessId)
    .eq("email", em)
    .maybeSingle()

  if (error && !error.message.toLowerCase().includes("0 rows")) {
    return { row: null as null, error: error.message }
  }
  const row = data ?? null
  if (row && (row.email ?? "").trim().toLowerCase() !== em) {
    return { row: null, error: null as null }
  }
  return { row, error: null as null }
}

async function readPendingToken(
  client: Client,
  businessId: string,
  staffMemberId: string,
  email: string,
): Promise<string | null> {
  const em = email.trim().toLowerCase()

  const { data: byEmail } = await client
    .from("business_invitations")
    .select("token")
    .eq("business_id", businessId)
    .eq("email", em)
    .eq("status", "pending")
    .limit(1)

  const emailTok = byEmail?.[0]?.token
  if (emailTok) return String(emailTok)

  const { data: byStaff } = await client
    .from("business_invitations")
    .select("token")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .limit(1)

  const staffTok = byStaff?.[0]?.token
  return staffTok ? String(staffTok) : null
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
    const ownerAuthEmail = await resolveOwnerAuthEmail(client, business.owner_id)
    if (ownerAuthEmail && ownerAuthEmail === em) {
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
    const pendingTok = await readPendingToken(client, businessId, staffMemberId, em)
    if (pendingTok) {
      return { ok: true, alreadyHasPanelAccess: true, invitationToken: pendingTok }
    }
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

  await client
    .from("business_invitations")
    .update({ status: "cancelled" })
    .eq("business_id", businessId)
    .eq("email", em)
    .eq("status", "pending")
    .or(`staff_member_id.is.null,staff_member_id.neq.${staffMemberId}`)

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

  const persistWithInvitedBy = async (invitedByValue: string | null) => {
    const patch = { ...invitationPatch, invited_by: invitedByValue }
    if (emailRow?.id) {
      return client
        .from("business_invitations")
        .update(patch)
        .eq("id", emailRow.id)
        .select("token")
        .single()
    }
    return client
      .from("business_invitations")
      .insert({
        business_id: businessId,
        ...patch,
      })
      .select("token")
      .single()
  }

  let write = await persistWithInvitedBy(invitedBy)
  if (write.error?.message?.toLowerCase().includes("foreign key") && invitedBy) {
    write = await persistWithInvitedBy(null)
  }

  if (write.error) {
    if (write.error.code === "23505" || write.error.message.toLowerCase().includes("duplicate")) {
      const { row: again } = await findInvitationByEmail(client, businessId, em)
      if (again?.id) {
        const retry = await client
          .from("business_invitations")
          .update(invitationPatch)
          .eq("id", again.id)
          .select("token")
          .single()
        if (retry.error) {
          return {
            ok: false,
            messageKey: "invitations.invitationCreateError",
            detail: retry.error.message,
          }
        }
        const retryTok = retry.data?.token ? String(retry.data.token) : null
        if (retryTok) return { ok: true, invitationToken: retryTok }
      }
    }
    return {
      ok: false,
      messageKey: "invitations.invitationCreateError",
      detail: write.error.message,
    }
  }

  const writtenToken = write.data?.token ? String(write.data.token) : null
  if (writtenToken) {
    return { ok: true, invitationToken: writtenToken }
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
    if (tok) {
      return { ok: true, alreadyHasPanelAccess: true, invitationToken: tok }
    }
    return null
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
  const viaRpc = await applyStaffPanelAccessViaRpc(
    client,
    businessId,
    staffMemberId,
    form,
    invitedBy,
  )
  if (viaRpc?.ok) return viaRpc
  if (
    viaRpc &&
    !viaRpc.ok &&
    viaRpc.messageKey !== "invitations.invitationCreateError"
  ) {
    return viaRpc
  }

  const direct = await applyStaffPanelAccessDirect(
    client,
    businessId,
    staffMemberId,
    form,
    invitedBy,
  )
  if (direct.ok) return direct

  if (viaRpc && !viaRpc.ok) {
    if (direct.messageKey === "invitations.invitationCreateError" && direct.detail) {
      return direct
    }
    return viaRpc
  }

  return direct
}
