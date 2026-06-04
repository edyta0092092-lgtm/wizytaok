import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import type { PanelRole } from "@/lib/auth/permissions"

type Client = SupabaseClient<Database>

export type StaffPanelFormSlice = {
  panelMemberRole: PanelRole
  invitationEmail: string
}

export type ApplyStaffPanelAccessResult =
  | { ok: true; invitationToken: string }
  | { ok: true; alreadyHasPanelAccess: true; invitationToken?: string | null }
  | { ok: false; messageKey: string; detail?: string }

async function findInvitationByEmail(
  client: Client,
  businessId: string,
  email: string,
) {
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

async function readPendingTokenForStaff(
  client: Client,
  businessId: string,
  staffMemberId: string,
): Promise<string | null> {
  const { data, error } = await client
    .from("business_invitations")
    .select("token")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("status", "pending")
    .maybeSingle()

  if (error || !data?.token) return null
  return String(data.token)
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

  let memberQuery = await client
    .from("business_members")
    .select("id, user_id")
    .eq("business_id", businessId)
    .eq("staff_member_id", staffMemberId)
    .eq("is_active", true)
    .maybeSingle()

  if (
    memberQuery.error?.message &&
    memberQuery.error.message.toLowerCase().includes("is_active") &&
    memberQuery.error.message.toLowerCase().includes("does not exist")
  ) {
    memberQuery = await client
      .from("business_members")
      .select("id, user_id")
      .eq("business_id", businessId)
      .eq("staff_member_id", staffMemberId)
      .maybeSingle()
  }

  const activeMember = memberQuery.data

  if (activeMember?.user_id) {
    const { error: memberUpdateErr } = await client
      .from("business_members")
      .update({
        role: form.panelMemberRole,
        email: em,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activeMember.id)

    if (memberUpdateErr) {
      return {
        ok: false,
        messageKey: "invitations.invitationCreateError",
        detail: memberUpdateErr.message,
      }
    }

    const pendingTok = await readPendingTokenForStaff(client, businessId, staffMemberId)
    return { ok: true, alreadyHasPanelAccess: true, invitationToken: pendingTok }
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
    emailRow?.status === "pending" &&
    emailRow.staff_member_id &&
    emailRow.staff_member_id !== staffMemberId
  ) {
    return { ok: false, messageKey: "team.panelInviteEmailConflict" }
  }

  if (
    emailRow?.status === "accepted" &&
    emailRow.staff_member_id &&
    emailRow.staff_member_id !== staffMemberId
  ) {
    return { ok: false, messageKey: "team.panelInviteEmailConflict" }
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

  const verified =
    (await readPendingTokenForStaff(client, businessId, staffMemberId)) ??
    (await (async () => {
      const { data } = await client
        .from("business_invitations")
        .select("token")
        .eq("business_id", businessId)
        .ilike("email", em)
        .eq("status", "pending")
        .maybeSingle()
      return data?.token ? String(data.token) : null
    })())

  if (!verified) {
    return {
      ok: false,
      messageKey: "invitations.invitationCreateError",
      detail: "invitation_not_persisted",
    }
  }

  return { ok: true, invitationToken: verified }
}
