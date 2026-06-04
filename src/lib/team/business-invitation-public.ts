import { getServiceRoleClient } from "@/lib/supabase/service-role"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type InvitationPublicResult =
  | {
      ok: true
      businessId: string
      businessName: string
      email: string
      role: string
      status: string
    }
  | { ok: false; error: string; status?: string }

export type AcceptInvitationResult =
  | { ok: true; businessId: string }
  | { ok: false; error: string }

export function isInvitationToken(value: string): boolean {
  return UUID_RE.test(value.trim())
}

export async function getBusinessInvitationPublic(
  token: string,
): Promise<InvitationPublicResult> {
  const trimmed = token.trim()
  if (!isInvitationToken(trimmed)) {
    return { ok: false, error: "invalid_token" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, error: "supabase_unconfigured" }
  }

  const { data: inv, error } = await admin
    .from("business_invitations")
    .select("id, business_id, email, role, status")
    .eq("token", trimmed)
    .maybeSingle()

  if (error) {
    return { ok: false, error: error.message || "lookup_failed" }
  }
  if (!inv?.id) {
    return { ok: false, error: "not_found" }
  }
  if (inv.status !== "pending") {
    return { ok: false, error: "not_pending", status: inv.status }
  }

  const { data: business } = await admin
    .from("business_profiles")
    .select("business_name")
    .eq("id", inv.business_id)
    .maybeSingle()

  return {
    ok: true,
    businessId: inv.business_id,
    businessName: business?.business_name?.trim() ?? "",
    email: (inv.email ?? "").trim(),
    role: inv.role ?? "staff",
    status: inv.status,
  }
}

export async function acceptBusinessInvitationForUser(
  token: string,
  userId: string,
  userEmail: string,
): Promise<AcceptInvitationResult> {
  const trimmed = token.trim()
  if (!isInvitationToken(trimmed)) {
    return { ok: false, error: "invalid_token" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, error: "supabase_unconfigured" }
  }

  const { data: inv, error: invErr } = await admin
    .from("business_invitations")
    .select("id, business_id, email, role, status, invited_by, staff_member_id")
    .eq("token", trimmed)
    .maybeSingle()

  if (invErr || !inv?.id) {
    return { ok: false, error: "not_found" }
  }
  if (inv.status === "accepted") {
    return { ok: false, error: "already_used" }
  }
  if (inv.status === "cancelled") {
    return { ok: false, error: "cancelled" }
  }
  if (inv.status !== "pending") {
    return { ok: false, error: "invalid_status" }
  }

  const invEmail = (inv.email ?? "").trim().toLowerCase()
  const authEmail = userEmail.trim().toLowerCase()
  if (!invEmail || !authEmail || invEmail !== authEmail) {
    return { ok: false, error: "email_mismatch" }
  }

  const memberBase = {
    business_id: inv.business_id,
    user_id: userId,
    role: inv.role === "admin" ? "admin" : "staff",
    email: inv.email,
    is_active: true,
    invited_by: inv.invited_by,
    updated_at: new Date().toISOString(),
  }

  const memberWithStaff = {
    ...memberBase,
    staff_member_id: inv.staff_member_id,
  }

  let memberErr = (
    await admin.from("business_members").upsert(memberWithStaff, {
      onConflict: "business_id,user_id",
    })
  ).error

  if (
    memberErr &&
    inv.staff_member_id &&
    (memberErr.message.toLowerCase().includes("staff_member_id") ||
      memberErr.message.toLowerCase().includes("does not exist"))
  ) {
    memberErr = (
      await admin.from("business_members").upsert(memberBase, {
        onConflict: "business_id,user_id",
      })
    ).error
  }

  if (memberErr) {
    return { ok: false, error: memberErr.message || "member_upsert_failed" }
  }

  const { error: updateErr } = await admin
    .from("business_invitations")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", inv.id)

  if (updateErr) {
    return { ok: false, error: updateErr.message || "invitation_update_failed" }
  }

  return { ok: true, businessId: inv.business_id }
}
