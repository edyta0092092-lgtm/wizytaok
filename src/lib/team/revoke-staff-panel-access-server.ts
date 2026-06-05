import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase()
}

/**
 * Usuwa osobę z zespołu i całkowicie odbiera dostęp do panelu firmy (business_members + zaproszenia).
 * Konto Auth użytkownika pozostaje — traci tylko członkostwo w tej firmie.
 */
export async function revokeStaffPanelAccessServer(
  admin: SupabaseClient<Database>,
  businessId: string,
  staffMemberId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const bid = businessId.trim()
  const sid = staffMemberId.trim()
  if (!bid || !sid) {
    return { ok: false, error: "invalid_input" }
  }

  const { data: staff, error: staffErr } = await admin
    .from("staff_members")
    .select("id, email, business_id")
    .eq("id", sid)
    .eq("business_id", bid)
    .maybeSingle()

  if (staffErr) {
    return { ok: false, error: staffErr.message }
  }
  if (!staff?.id) {
    return { ok: false, error: "staff_not_found" }
  }

  const staffEmail = normalizeEmail(staff.email)

  const { data: business } = await admin
    .from("business_profiles")
    .select("owner_id")
    .eq("id", bid)
    .maybeSingle()

  const { data: members } = await admin
    .from("business_members")
    .select("id, user_id, staff_member_id, email")
    .eq("business_id", bid)

  const memberIdsToRemove = new Set<string>()
  for (const row of members ?? []) {
    if (!row.id) continue
    if (row.staff_member_id === sid) {
      memberIdsToRemove.add(row.id)
      continue
    }
    if (staffEmail && normalizeEmail(row.email) === staffEmail) {
      memberIdsToRemove.add(row.id)
    }
  }

  for (const memberId of memberIdsToRemove) {
    const member = (members ?? []).find((m) => m.id === memberId)
    if (business?.owner_id && member?.user_id === business.owner_id) {
      return { ok: false, error: "cannot_remove_owner" }
    }
  }

  if (memberIdsToRemove.size > 0) {
    const { error: memberDeleteErr } = await admin
      .from("business_members")
      .delete()
      .eq("business_id", bid)
      .in("id", [...memberIdsToRemove])
    if (memberDeleteErr) {
      return { ok: false, error: memberDeleteErr.message }
    }
  }

  const { data: openInvites } = await admin
    .from("business_invitations")
    .select("id, email, staff_member_id, status")
    .eq("business_id", bid)
    .in("status", ["pending", "accepted"])

  const inviteIdsToCancel: string[] = []
  for (const inv of openInvites ?? []) {
    if (!inv.id) continue
    if (inv.staff_member_id === sid) {
      inviteIdsToCancel.push(inv.id)
      continue
    }
    if (staffEmail && normalizeEmail(inv.email) === staffEmail) {
      inviteIdsToCancel.push(inv.id)
    }
  }

  if (inviteIdsToCancel.length > 0) {
    const { error: inviteErr } = await admin
      .from("business_invitations")
      .update({ status: "cancelled" })
      .eq("business_id", bid)
      .in("id", inviteIdsToCancel)
    if (inviteErr) {
      return { ok: false, error: inviteErr.message }
    }
  }

  const { error: deleteStaffErr } = await admin
    .from("staff_members")
    .delete()
    .eq("id", sid)
    .eq("business_id", bid)

  if (deleteStaffErr) {
    return { ok: false, error: deleteStaffErr.message }
  }

  return { ok: true }
}
