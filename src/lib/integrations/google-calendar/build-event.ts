import type { Tables } from "@/types/database"

const DEFAULT_TZ = "Europe/Warsaw"

export function buildWizytaOkBookingPanelUrl(bookingId: string, businessSlug: string | null): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ""
  const base = origin.replace(/\/$/, "")
  const path = `/appointments?highlight=${encodeURIComponent(`sb-${bookingId}`)}`
  if (base) return `${base}${path}`
  if (businessSlug) return `/appointments?highlight=sb-${bookingId}`
  return path
}

export function buildGoogleCalendarEventFromBooking(input: {
  booking: Tables<"bookings">
  businessSlug: string | null
  businessName: string | null
  cancelled?: boolean
}): {
  summary: string
  description: string
  startIso: string
  endIso: string
  timeZone: string
} {
  const { booking, businessSlug, businessName, cancelled } = input
  const date = String(booking.appointment_date ?? "").slice(0, 10)
  const time = String(booking.appointment_time ?? "").slice(0, 5)
  const durationMinutes = Math.max(15, booking.service_duration_minutes ?? 60)
  const start = new Date(`${date}T${time}:00`)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  const staff = booking.staff_name?.trim() || "—"
  const client = booking.client_name?.trim() || "—"
  const service = booking.service_name?.trim() || "Wizyta"
  const panelUrl = buildWizytaOkBookingPanelUrl(booking.id, businessSlug)
  const token = booking.confirmation_token?.trim()
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ""
  const manageUrl =
    token && origin
      ? `${origin.replace(/\/$/, "")}/confirm/${encodeURIComponent(token)}`
      : panelUrl
  const prefix = cancelled ? "[Anulowana] " : ""
  const summary = `${prefix}${service} — ${client}`
  const lines = [
    `Usługa: ${service}`,
    `Klient: ${client}`,
    `Godzina: ${time}`,
    `Pracownik: ${staff}`,
    businessName ? `Firma: ${businessName}` : null,
    `Zarządzaj wizytą: ${manageUrl}`,
    `Panel WizytaOK: ${panelUrl}`,
  ].filter(Boolean)

  return {
    summary,
    description: lines.join("\n"),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timeZone: DEFAULT_TZ,
  }
}
