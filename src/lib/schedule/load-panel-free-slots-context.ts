import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getAvailabilityExceptionsForBusiness,
  getAvailabilityRules,
} from "@/lib/availability/availability-store"
import { indexExceptionsByDate } from "@/lib/booking/effective-availability"
import { getBookedSlotsForBusiness } from "@/lib/bookings/slot-availability"
import { getStaffAvailabilityContextForBusiness } from "@/lib/staff/staff-store"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import type { Database } from "@/types/database"
import type { StaffMember } from "@/types/domain"

import type { StaffAvailabilityContext } from "./compute-panel-free-slots"

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(year, month, 0).getDate()
  return {
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(last)}`,
  }
}

export type PanelFreeSlotsLoadResult = {
  businessAvailability: Awaited<ReturnType<typeof getAvailabilityRules>>
  businessExceptionsByDate: ReturnType<typeof indexExceptionsByDate>
  bookedSlots: Awaited<ReturnType<typeof getBookedSlotsForBusiness>>
  staffContexts: Map<string, StaffAvailabilityContext>
}

export async function loadPanelFreeSlotsContext(
  client: SupabaseClient<Database> | null,
  businessId: string | null,
  staffMembers: StaffMember[],
  year: number,
  month: number,
): Promise<PanelFreeSlotsLoadResult | null> {
  if (!client || !businessId || !isSupabaseConfigured()) return null

  const { from, to } = monthRange(year, month)
  const activeStaff = staffMembers.filter((s) => s.isActive)

  const [businessAvailability, exceptions, bookedSlots, ...contexts] = await Promise.all([
    getAvailabilityRules(client, businessId),
    getAvailabilityExceptionsForBusiness(client, businessId, from, to),
    getBookedSlotsForBusiness(client, businessId, from, to),
    ...activeStaff.map(async (m) => {
      const ctx = await getStaffAvailabilityContextForBusiness(client, businessId, m.id)
      return [m.id, ctx] as const
    }),
  ])

  const staffContexts = new Map<string, StaffAvailabilityContext>()
  for (const [id, ctx] of contexts) {
    staffContexts.set(id, ctx)
  }

  return {
    businessAvailability,
    businessExceptionsByDate: indexExceptionsByDate(exceptions),
    bookedSlots,
    staffContexts,
  }
}
