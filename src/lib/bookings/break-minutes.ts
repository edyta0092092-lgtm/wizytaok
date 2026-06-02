import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

/**
 * Przerwa po usłudze: null na usłudze = domyślna firmy; brak obu = 0.
 */
export function resolveBreakMinutes(
  serviceBreakMinutes: number | null | undefined,
  defaultBreakMinutes: number | null | undefined,
): number {
  if (serviceBreakMinutes != null && Number.isFinite(serviceBreakMinutes)) {
    return Math.max(0, Math.floor(serviceBreakMinutes))
  }
  if (defaultBreakMinutes != null && Number.isFinite(defaultBreakMinutes)) {
    return Math.max(0, Math.floor(defaultBreakMinutes))
  }
  return 0
}

export function schedulingBlockedMinutes(
  durationMinutes: number,
  breakMinutes: number,
): number {
  return Math.max(1, Math.floor(durationMinutes || 0)) + Math.max(0, Math.floor(breakMinutes || 0))
}

export async function fetchDefaultBreakMinutesForBusiness(
  client: SupabaseClient<Database>,
  businessId: string,
): Promise<number | null> {
  const { data } = await client
    .from("business_profiles")
    .select("default_break_minutes")
    .eq("id", businessId.trim())
    .maybeSingle()
  if (data?.default_break_minutes == null || !Number.isFinite(Number(data.default_break_minutes))) {
    return null
  }
  return Math.max(0, Math.floor(Number(data.default_break_minutes)))
}
