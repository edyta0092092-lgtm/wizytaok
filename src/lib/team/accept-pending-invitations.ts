import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { acceptBusinessInvitationForUser } from "@/lib/team/business-invitation-public"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

type InvitationRow = {
  id: string
  token: string | null
  email: string | null
  status: string | null
  business_id: string
  role: string | null
  invited_by: string | null
  staff_member_id: string | null
}

export type AcceptPendingInvitationsResult = {
  linked: boolean
  businessId?: string
  source?: string
  error?: string
  detail?: string
}

async function upsertMemberFromInvitation(
  invitation: InvitationRow,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const admin = getServiceRoleClient()
  if (!admin) return { ok: false, error: "supabase_unconfigured" }

  const memberBase = {
    business_id: invitation.business_id,
    user_id: userId,
    role: invitation.role === "admin" ? "admin" : "staff",
    email: invitation.email,
    is_active: true,
    invited_by: invitation.invited_by,
    updated_at: new Date().toISOString(),
  }

  const memberWithStaff = {
    ...memberBase,
    staff_member_id: invitation.staff_member_id,
  }

  let memberErr = (
    await admin.from("business_members").upsert(memberWithStaff, {
      onConflict: "business_id,user_id",
    })
  ).error

  if (
    memberErr &&
    invitation.staff_member_id &&
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
    return { ok: false, error: memberErr.message }
  }
  return { ok: true }
}

async function findInvitationsForEmail(email: string): Promise<InvitationRow[]> {
  const admin = getServiceRoleClient()
  if (!admin) return []

  const normalized = normalizeEmail(email)
  const byId = new Map<string, InvitationRow>()

  const { data: allOpen } = await admin
    .from("business_invitations")
    .select("id, token, email, status, business_id, role, invited_by, staff_member_id")
    .in("status", ["pending", "accepted"])

  for (const row of allOpen ?? []) {
    if (normalizeEmail(row.email ?? "") === normalized) {
      byId.set(row.id, row as InvitationRow)
    }
  }

  const { data: staffRows } = await admin.from("staff_members").select("id, email")
  const staffIds = (staffRows ?? [])
    .filter((s) => normalizeEmail(s.email ?? "") === normalized)
    .map((s) => s.id)
    .filter(Boolean)

  if (staffIds.length > 0) {
    const { data: byStaff } = await admin
      .from("business_invitations")
      .select("id, token, email, status, business_id, role, invited_by, staff_member_id")
      .in("staff_member_id", staffIds)
      .in("status", ["pending", "accepted"])

    for (const row of byStaff ?? []) {
      byId.set(row.id, row as InvitationRow)
    }
  }

  return [...byId.values()]
}

async function readMemberBusinessId(userId: string): Promise<string | null> {
  const admin = getServiceRoleClient()
  if (!admin) return null

  let query = await admin
    .from("business_members")
    .select("business_id, is_active")
    .eq("user_id", userId)
    .limit(5)

  if (
    query.error?.message?.toLowerCase().includes("is_active") &&
    query.error.message.toLowerCase().includes("does not exist")
  ) {
    const fallback = await admin
      .from("business_members")
      .select("business_id")
      .eq("user_id", userId)
      .limit(5)
    return fallback.data?.[0]?.business_id ?? null
  }

  const rows = query.data ?? []
  const active = rows.find((r) => r.is_active !== false)
  if (active?.business_id) return active.business_id

  const inactive = rows.find((r) => r.business_id)
  if (inactive?.business_id) {
    await admin
      .from("business_members")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("business_id", inactive.business_id)
    return inactive.business_id
  }

  return null
}

/**
 * Powiąż zalogowanego użytkownika z firmą na podstawie oczekujących lub już zaakceptowanych zaproszeń (e-mail).
 */
export async function acceptPendingInvitationsForUser(
  userId: string,
  userEmail: string,
): Promise<AcceptPendingInvitationsResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return { linked: false, error: "supabase_unconfigured" }
  }

  const email = normalizeEmail(userEmail)
  if (!email) {
    return { linked: false, error: "email_required" }
  }

  const existingBusinessId = await readMemberBusinessId(userId)
  if (existingBusinessId) {
    return { linked: true, businessId: existingBusinessId, source: "existing_member" }
  }

  const rows = await findInvitationsForEmail(email)
  const pending = rows.filter((row) => row.status === "pending")
  const accepted = rows.filter((row) => row.status === "accepted")

  const acceptErrors: string[] = []

  for (const inv of pending) {
    if (!inv.token) continue
    const acceptOut = await acceptBusinessInvitationForUser(String(inv.token), userId, email)
    if (acceptOut.ok) {
      return {
        linked: true,
        businessId: acceptOut.businessId,
        source: "pending",
      }
    }
    acceptErrors.push(acceptOut.error)
  }

  for (const inv of accepted) {
    const repair = await upsertMemberFromInvitation(inv, userId)
    if (repair.ok) {
      return {
        linked: true,
        businessId: inv.business_id,
        source: "accepted_repaired",
      }
    }
    acceptErrors.push(repair.error ?? "repair_failed")
  }

  if (pending.length > 0 || accepted.length > 0) {
    return {
      linked: false,
      error: "accept_failed",
      detail: acceptErrors.filter(Boolean).join("; ") || undefined,
    }
  }

  return { linked: false, error: "no_invitation" }
}

export async function tryLinkStaffAfterAuth(
  userId: string,
  userEmail: string,
): Promise<string | null> {
  const result = await acceptPendingInvitationsForUser(userId, userEmail)
  return result.linked ? result.businessId ?? null : null
}
