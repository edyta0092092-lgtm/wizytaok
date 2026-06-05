import type { ClientPortalBooking } from "@/lib/client-portal/types"
import type { PublicBooking } from "@/lib/bookings/public-bookings"

type BookingRow = {
  id: string
  business_id: string
  service_id?: string | null
  service_name: string
  service_duration_minutes?: number | null
  appointment_date: string
  appointment_time: string
  status: string
  staff_id?: string | null
  staff_name: string | null
  confirmation_token: string | null
  business_profiles?: { business_name?: string; slug?: string | null } | null
}

const TERMINAL_HISTORY_STATUSES = new Set(["completed", "cancelled", "no_show"])

export function mapBookingRowToClientPortal(row: BookingRow): ClientPortalBooking {
  const date = String(row.appointment_date ?? "").slice(0, 10)
  const time = String(row.appointment_time ?? "09:00").slice(0, 5)
  const profile = row.business_profiles
  return {
    id: row.id,
    businessId: row.business_id,
    businessName: profile?.business_name?.trim() || "—",
    businessSlug: profile?.slug?.trim() || null,
    serviceId: typeof row.service_id === "string" ? row.service_id.trim() || null : null,
    serviceName: row.service_name?.trim() || "—",
    serviceDurationMinutes: Math.max(
      1,
      Math.floor(Number(row.service_duration_minutes ?? 60) || 60),
    ),
    appointmentDate: date,
    appointmentTime: time,
    startsAtIso: `${date}T${time}:00`,
    status: row.status,
    staffId: typeof row.staff_id === "string" ? row.staff_id.trim() || null : null,
    staffName: row.staff_name?.trim() || null,
    confirmationToken: row.confirmation_token?.trim() || null,
  }
}

export function clientPortalBookingToPublicBooking(booking: ClientPortalBooking): PublicBooking {
  return {
    id: booking.id,
    confirmationToken: booking.confirmationToken ?? undefined,
    businessSlug: booking.businessSlug ?? "",
    serviceId: booking.serviceId ?? undefined,
    staffId: booking.staffId ?? undefined,
    staffName: booking.staffName ?? undefined,
    serviceName: booking.serviceName,
    serviceDurationMinutes: booking.serviceDurationMinutes,
    servicePrice: 0,
    date: booking.appointmentDate,
    time: booking.appointmentTime,
    customerName: "",
    customerPhone: "",
    status: "confirmed",
    source: "online",
    createdAt: new Date().toISOString(),
  }
}

export function isBookingUpcoming(booking: ClientPortalBooking, now = Date.now()): boolean {
  if (TERMINAL_HISTORY_STATUSES.has(booking.status)) return false
  const t = new Date(booking.startsAtIso).getTime()
  return !Number.isNaN(t) && t >= now
}

export function isBookingHistory(booking: ClientPortalBooking): boolean {
  return TERMINAL_HISTORY_STATUSES.has(booking.status)
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
    .filter((b) => isBookingHistory(b))
    .sort((a, b) => sortBookingsByStartsAt(a, b, "desc"))

  const visitCount = bookings.filter((b) => b.status !== "cancelled").length
  const lastBooking = history[0] ?? null
  const lastServiceName =
    lastBooking?.serviceName ??
    bookings
      .filter((b) => b.status === "completed")
      .sort((a, b) => sortBookingsByStartsAt(a, b, "desc"))[0]?.serviceName ??
    null

  return {
    nextBooking: upcoming[0] ?? null,
    lastBooking,
    visitCount,
    lastServiceName,
    upcoming,
    history,
  }
}
