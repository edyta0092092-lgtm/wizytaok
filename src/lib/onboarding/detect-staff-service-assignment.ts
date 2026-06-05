import type { SupabaseClient } from "@supabase/supabase-js"

import { hasAnyStaffServiceAssignment } from "@/lib/staff/staff-store"

/** Czy w firmie jest przypisanie usługi do osoby (logika jak ekran Zespół). */
export async function detectStaffServiceAssignment(
  client: SupabaseClient,
  businessId: string,
): Promise<boolean> {
  return hasAnyStaffServiceAssignment(client, businessId)
}
