import type { SupabaseClient } from "@supabase/supabase-js"

import { getStaffServiceIds } from "@/lib/staff/staff-store"

function staffIdFromLinkRow(row: Record<string, unknown>): string {
  const a = row.staff_member_id
  const b = row.staff_id
  if (typeof a === "string" && a.trim()) return a.trim()
  if (typeof b === "string" && b.trim()) return b.trim()
  return ""
}

/**
 * Czy w firmie jest co najmniej jedna aktywna osoba z przypisaną usługą.
 * Używa tej samej logiki odczytu co ekran Zespół (staff_id / staff_member_id / brak business_id).
 */
export async function detectStaffServiceAssignment(
  client: SupabaseClient,
  businessId: string,
): Promise<boolean> {
  const bid = businessId.trim()
  if (!bid) return false

  const { data: staffRows } = await client
    .from("staff_members")
    .select("id")
    .eq("business_id", bid)
    .eq("is_active", true)

  const staffIds = (staffRows ?? []).map((r) => r.id).filter(Boolean)
  if (staffIds.length === 0) return false

  for (const staffId of staffIds) {
    const serviceIds = await getStaffServiceIds(client, bid, staffId)
    if (serviceIds.length > 0) return true
  }

  const { data: linked, error } = await client
    .from("staff_services")
    .select("staff_id, staff_member_id, service_id, business_id")
    .eq("business_id", bid)
    .limit(100)

  if (!error && linked?.length) {
    const ok = linked.some((row) => {
      const sid = staffIdFromLinkRow(row as Record<string, unknown>)
      return Boolean(sid && staffIds.includes(sid) && row.service_id)
    })
    if (ok) return true
  }

  for (const staffId of staffIds.slice(0, 15)) {
    const byStaff = await client
      .from("staff_services")
      .select("service_id")
      .eq("staff_id", staffId)
      .limit(1)
    if (byStaff.data?.length) return true

    const byMember = await client
      .from("staff_services")
      .select("service_id")
      .eq("staff_member_id", staffId)
      .limit(1)
    if (byMember.data?.length) return true
  }

  return false
}
