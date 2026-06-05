import {
  buildClientPortalDashboard,
  mapBookingRowToClientPortal,
} from "@/lib/client-portal/map-booking"
import type { ClientPortalBooking, ClientPortalDashboard } from "@/lib/client-portal/types"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

const BOOKING_SELECT =
  "id,business_id,service_name,appointment_date,appointment_time,status,staff_name,confirmation_token,client_email"

export async function fetchClientBookingsByEmail(
  email: string,
): Promise<{ bookings: ClientPortalBooking[]; dashboard: ClientPortalDashboard }> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return {
      bookings: [],
      dashboard: buildClientPortalDashboard([]),
    }
  }

  const normalized = email.trim().toLowerCase()
  const { data, error } = await admin
    .from("bookings")
    .select(BOOKING_SELECT)
    .ilike("client_email", normalized)
    .order("appointment_date", { ascending: false })
    .order("appointment_time", { ascending: false })
    .limit(200)

  if (error || !data) {
    return {
      bookings: [],
      dashboard: buildClientPortalDashboard([]),
    }
  }

  const rows = data.filter(
    (row) => String(row.client_email ?? "").trim().toLowerCase() === normalized,
  )

  const businessIds = [...new Set(rows.map((r) => r.business_id).filter(Boolean))]
  const businessMap = new Map<string, { business_name: string; slug: string | null }>()

  if (businessIds.length > 0) {
    const { data: profiles } = await admin
      .from("business_profiles")
      .select("id,business_name,slug")
      .in("id", businessIds)
    for (const p of profiles ?? []) {
      businessMap.set(p.id, {
        business_name: p.business_name ?? "",
        slug: p.slug ?? null,
      })
    }
  }

  const bookings = rows.map((row) =>
    mapBookingRowToClientPortal({
      ...row,
      business_profiles: businessMap.get(row.business_id) ?? null,
    }),
  )

  return {
    bookings,
    dashboard: buildClientPortalDashboard(bookings),
  }
}
