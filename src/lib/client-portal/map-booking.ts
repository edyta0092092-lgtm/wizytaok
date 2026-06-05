import type { ClientPortalBooking } from "@/lib/client-portal/types"

type BookingRow = {
  id: string
  business_id: string
  service_name: string
  appointment_date: string
  appointment_time: string
  status: string
  staff_name: string | null
  confirmation_token: string | null
  business_profiles?: { business_name?: string; slug?: string | null } | null
}

export function mapBookingRowToClientPortal(row: BookingRow): ClientPortalBooking {
  const date = String(row.appointment_date ?? "").slice(0, 10)
  const time = String(row.appointment_time ?? "09:00").slice(0, 5)
  const profile = row.business_profiles
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: profile?.business_name?.trim() || "—",
    businessSlug: profile?.slug?.trim() || null,
    serviceName: row.service_name?.trim() || "—",
    appointmentDate: date,
    appointmentTime: time,
    startsAtIso: `${date}T${time}:00`,
    status: row.status,
    staffName: row.staff_name?.trim() || null,
    confirmationToken: row.confirmation_token?.trim() || null,
  }
}

export function isBookingUpcoming(booking: ClientPortalBooking, now = Date.now()): boolean {
  if (booking.status === "cancelled") return false
  const t = new Date(booking.startsAtIso).getTime()
  return !Number.isNaN(t) && t >= now
}

export function isBookingHistory(booking: ClientPortalBooking, now = Date.now()): boolean {
  if (booking.status === "cancelled") return true
  const t = new Date(booking.startsAtIso).getTime()
  return !Number.isNaN(t) && t < now
}

export function sortBookingsByStartsAt(
  a: ClientPortalBooking,
  b: ClientPortalBooking,
  direction: "asc" | "desc",
): number {
  const ta = new Date(a.startsAtIso).getTime()
  const tb = new Date(b.startsAtIso).getTime()
  return direction === "asc" ? ta - tb : tb - ta
}

export function buildClientPortalDashboard(
  bookings: ClientPortalBooking[],
): import("@/lib/client-portal/types").ClientPortalDashboard {
  const now = Date.now()
  const upcoming = bookings
    .filter((b) => isBookingUpcoming(b, now))
    .sort((a, b) => sortBookingsByStartsAt(a, b, "asc"))
  const history = bookings
    .filter((b) => isBookingHistory(b, now))
    .sort((a, b) => sortBookingsByStartsAt(a, b, "desc"))

  const completedOrPast = bookings
    .filter((b) => b.status === "completed" || isBookingHistory(b, now))
    .sort((a, b) => sortBookingsByStartsAt(a, b, "desc"))

  const visitCount = bookings.filter((b) => b.status !== "cancelled").length
  const lastServiceName = completedOrPast[0]?.serviceName ?? history[0]?.serviceName ?? null

  return {
    nextBooking: upcoming[0] ?? null,
    visitCount,
    lastServiceName,
    upcoming,
    history,
  }
}
