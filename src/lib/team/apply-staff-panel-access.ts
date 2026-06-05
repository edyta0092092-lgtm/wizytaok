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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function resolveOwnerAuthEmail(client: Client, ownerId: string): Promise<string | null> {
  const { data, error } = await client.auth.admin.getUserById(ownerId)
  if (error || !data?.user?.email?.trim()) return null
  return normalizeEmail(data.user.email)
}

async function findInvitationByEmail(client: Client, businessId: string, email: string) {
  const em = normalizeEmail(email)
  const { data, error } = await client
    .from("business_invitations")
    .select("id, status, staff_member_id, email")
    .eq("business_id", businessId)
    .ilike("email", em)

  if (error) return { row: null as null, error: error.message }
  const row =
    (data ?? []).find((r) => normalizeEmail(r.email ?? "") === em) ?? null
  return { row, error: null as null }
}

async function readPendingToken(
  client: Client,
  businessId: string,
  staffMemberId: string,
  email: string,
): Promise<string | null> {
  const em = normalizeEmail(email)

  const { data: pendingRows } = await client
    .from("business_invitations")
    .select("token, email, staff_member_id")
    .eq("business_id", businessId)
    .eq("status", "pending")

  const rows = pendingRows ?? []
  const byEmail = rows.find((r) => normalizeEmail(r.email ?? "") === em)
  if (byEmail?.token) return String(byEmail.token)

  const byStaff = rows.find((r) => r.staff_member_id === staffMemberId)
  return byStaff?.token ? String(byStaff.token) : null
}

export type StaffBusinessMemberLink = {
  memberId: string
  userId: string | null
}

/** Znajdź członkostwo po staff_member_id lub po tym samym e-mailu (gdy brak powiązania FK). */
export async function resolveStaffBusinessMemberLink(
  client: Client,
  businessId: string,
  staffMemberId: string,
  invitationEmail?: string,
): Promise<StaffBusinessMemberLink | null> {
  const { data: byStaffId } = await client
    .from("business_members")
    .select("id, user_id, email")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .maybeSingle()

  if (byStaffId?.id) {
    return { memberId: byStaffId.id, userId: byStaffId.user_id ?? null }
  }

  let emailNorm = normalizeEmail(invitationEmail ?? "")
  if (!emailNorm) {
    const { data: staffRow } = await client
      .from("staff_members")
      .select("email")
      .eq("id", staffMemberId)
      .eq("business_id", businessId)
      .maybeSingle()
    emailNorm = normalizeEmail(staffRow?.email ?? "")
  }
  if (!emailNorm) return null

  const { data: members } = await client
    .from("business_members")
    .select("id, user_id, email")
    .eq("business_id", businessId)

  const byEmail = (members ?? []).find((m) => normalizeEmail(m.email ?? "") === emailNorm)
  if (!byEmail?.id) return null
  return { memberId: byEmail.id, userId: byEmail.user_id ?? null }
}

/** Czy osoba ma już konto powiązane z firmą (zalogowany członek zespołu). */
export async function staffHasLinkedPanelAccount(
  client: Client,
  businessId: string,
  staffMemberId: string,
  invitationEmail?: string,
): Promise<boolean> {
  const link = await resolveStaffBusinessMemberLink(
    client,
    businessId,
    staffMemberId,
    invitationEmail,
  )
  return Boolean(link?.userId)
}

/** Uaktualnia rolę panelu przy istniejącym powiązaniu biznes‑członkostwo ↔ staff (bez wymuszania zaproszenia). */
export async function syncBusinessMemberRoleForStaff(
  client: Client,
  businessId: string,
  staffMemberId: string,
  role: PanelRole,
  invitationEmail?: string,
): Promise<{ ok: boolean; detail?: string; updated: boolean }> {
  const link = await resolveStaffBusinessMemberLink(
    client,
    businessId,
    staffMemberId,
    invitationEmail,
  )
  if (!link?.memberId) return { ok: true, updated: false }

  const patch: Record<string, unknown> = {
    role,
    updated_at: new Date().toISOString(),
    staff_member_id: staffMemberId,
  }

  let { error } = await client.from("business_members").update(patch).eq("id", link.memberId)

  if (error?.message?.toLowerCase().includes("staff_member_id")) {
    const { staff_member_id: _omit, ...withoutStaff } = patch
    void _omit
    const retry = await client.from("business_members").update(withoutStaff).eq("id", link.memberId)
    error = retry.error
  }

  if (error) return { ok: false, detail: error.message, updated: false }
  return { ok: true, updated: true }
}

/** Aktualizuje rolę w oczekującym zaproszeniu (bez wysyłki e-maila). */
export async function syncPendingInvitationRoleForStaff(
  client: Client,
  businessId: string,
  staffMemberId: string,
  role: PanelRole,
  invitationEmail?: string,
): Promise<{ ok: boolean; detail?: string }> {
  let emailNorm = normalizeEmail(invitationEmail ?? "")
  if (!emailNorm) {
    const { data: staffRow } = await client
      .from("staff_members")
      .select("email")
      .eq("id", staffMemberId)
      .eq("business_id", businessId)
      .maybeSingle()
    emailNorm = normalizeEmail(staffRow?.email ?? "")
  }

  const { error: byStaffErr } = await client
    .from("business_invitations")
    .update({ role })
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")

  if (byStaffErr) return { ok: false, detail: byStaffErr.message }

  if (emailNorm) {
    const { data: pending } = await client
      .from("business_invitations")
      .select("id, email")
      .eq("business_id", businessId)
      .eq("status", "pending")

    const ids = (pending ?? [])
      .filter((row) => normalizeEmail(row.email ?? "") === emailNorm)
      .map((row) => row.id)
      .filter(Boolean)

    if (ids.length > 0) {
      const { error: byEmailErr } = await client
        .from("business_invitations")
        .update({ role, staff_member_id: staffMemberId })
        .eq("business_id", businessId)
        .in("id", ids)
      if (byEmailErr) return { ok: false, detail: byEmailErr.message }
    }
  }

  return { ok: true }
}

async function writeInvitationRow(
  client: Client,
  businessId: string,
  emailRowId: string | null,
  invitationPatch: Record<string, unknown>,
): Promise<{ token: string | null; error: string | null }> {
  if (emailRowId) {
    const { data, error } = await client
      .from("business_invitations")
      .update(invitationPatch)
      .eq("id", emailRowId)
      .select("token")

    if (error) return { token: null, error: error.message }
    const tok = data?.[0]?.token ? String(data[0].token) : null
    if (tok) return { token: tok, error: null }
  }

  const { data, error } = await client
    .from("business_invitations")
    .insert({
      business_id: businessId,
      ...invitationPatch,
    })
    .select("token")

  if (error) return { token: null, error: error.message }
  const tok = data?.[0]?.token ? String(data[0].token) : null
  return { token: tok, error: null }
}

async function applyStaffPanelAccessDirect(
  client: Client,
  businessId: string,
  staffMemberId: string,
  form: StaffPanelFormSlice,
  invitedBy: string | null,
): Promise<ApplyStaffPanelAccessResult> {
  const em = normalizeEmail(form.invitationEmail)
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

  if (membersQuery.error) {
    return {
      ok: false,
      messageKey: "invitations.invitationCreateError",
      detail: membersQuery.error.message,
    }
  }

  const members = membersQuery.data ?? []
  const linkedMember = await resolveStaffBusinessMemberLink(
    client,
    businessId,
    staffMemberId,
    em,
  )
  if (linkedMember?.userId) {
    const roleSync = await syncBusinessMemberRoleForStaff(
      client,
      businessId,
      staffMemberId,
      form.panelMemberRole,
      em,
    )
    if (!roleSync.ok) {
      return {
        ok: false,
        messageKey: "invitations.invitationCreateError",
        detail: roleSync.detail,
      }
    }
    await syncPendingInvitationRoleForStaff(
      client,
      businessId,
      staffMemberId,
      form.panelMemberRole,
      em,
    )
    return { ok: true, alreadyHasPanelAccess: true, invitationToken: null }
  }

  const otherActiveMemberWithEmail = members.find((m) => {
    if (!m.user_id || !m.staff_member_id) return false
    if (m.staff_member_id === staffMemberId) return false
    return normalizeEmail(m.email ?? "") === em
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
    .ilike("email", em)
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

  let write = await writeInvitationRow(client, businessId, emailRow?.id ?? null, invitationPatch)
  if (write.error?.toLowerCase().includes("foreign key") && invitedBy) {
    write = await writeInvitationRow(client, businessId, emailRow?.id ?? null, {
      ...invitationPatch,
      invited_by: null,
    })
  }

  if (write.error) {
    const isDuplicate =
      write.error.toLowerCase().includes("duplicate") ||
      write.error.includes("23505") ||
      write.error.toLowerCase().includes("business_invitations_business_id_email")
    if (isDuplicate) {
      const { row: again } = await findInvitationByEmail(client, businessId, em)
      if (again?.id) {
        write = await writeInvitationRow(client, businessId, again.id, invitationPatch)
      }
    }
    if (write.error) {
      return {
        ok: false,
        messageKey: "invitations.invitationCreateError",
        detail: write.error,
      }
    }
  }

  if (write.token) {
    return { ok: true, invitationToken: write.token }
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
    p_email: normalizeEmail(form.invitationEmail),
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
  const direct = await applyStaffPanelAccessDirect(
    client,
    businessId,
    staffMemberId,
    form,
    invitedBy,
  )
  if (direct.ok) return direct
  if (direct.messageKey !== "invitations.invitationCreateError") return direct

  const viaRpc = await applyStaffPanelAccessViaRpc(
    client,
    businessId,
    staffMemberId,
    form,
    invitedBy,
  )
  if (viaRpc?.ok) return viaRpc
  if (viaRpc && !viaRpc.ok && viaRpc.messageKey !== "invitations.invitationCreateError") {
    return viaRpc
  }

  if (direct.detail) return direct
  return viaRpc ?? direct
}
