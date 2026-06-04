import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { acceptBusinessInvitationForUser } from "@/lib/team/business-invitation-public"

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type AcceptPendingInvitationsResult = {
  linked: boolean
  businessId?: string
  /** pending | accepted_repaired */
  source?: string
  error?: string
}

async function upsertMemberFromInvitation(
  invitation: {
    business_id: string
    email: string | null
    role: string | null
    invited_by: string | null
    staff_member_id: string | null
  },
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

  const { data: existingMembers } = await admin
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)

  const existingBusinessId = existingMembers?.[0]?.business_id
  if (existingBusinessId) {
    return { linked: true, businessId: existingBusinessId, source: "existing_member" }
  }

  const { data: invitations, error: invErr } = await admin
    .from("business_invitations")
    .select("id, token, email, status, business_id, role, invited_by, staff_member_id")
    .in("status", ["pending", "accepted"])
    .ilike("email", email)

  if (invErr) {
    return { linked: false, error: invErr.message }
  }

  const rows = (invitations ?? []).filter((row) => normalizeEmail(row.email ?? "") === email)
  const pending = rows.filter((row) => row.status === "pending")
  const accepted = rows.filter((row) => row.status === "accepted")

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
  }

  return { linked: false, error: pending.length > 0 ? "accept_failed" : "no_invitation" }
}
