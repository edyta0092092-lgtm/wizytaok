import {
  resolveSupabaseBookingRowUuidFromUiId,
  SB_BOOKING_PREFIX,
} from "@/lib/bookings/bookings-store"

const STORAGE_PREFIX = "pw_appointments_panel_dismissed_v1_"

export const APPOINTMENTS_PANEL_DISMISSED_EVENT = "pw-appointments-dismissed"

function storageKey(businessId: string | null | undefined): string {
  const bid = businessId?.trim()
  return `${STORAGE_PREFIX}${bid && bid.length > 0 ? bid : "global"}`
}

function readIds(businessId: string | null | undefined): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(storageKey(businessId))
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => id.length > 0),
    )
  } catch {
    return new Set()
  }
}

function writeIds(businessId: string | null | undefined, ids: Set<string>): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey(businessId), JSON.stringify([...ids]))
}

/** Kanoniczny klucz wiersza listy (sb-{uuid} dla rezerwacji Supabase). */
export function normalizePanelDismissId(appointmentId: string): string {
  const tid = appointmentId.trim()
  if (!tid) return ""
  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(tid)
  if (bookingUuid) return `${SB_BOOKING_PREFIX}${bookingUuid}`
  return tid
}

export function dismissAppointmentFromPanel(
  appointmentId: string,
  businessId?: string | null,
): void {
  const key = normalizePanelDismissId(appointmentId)
  if (!key) return
  const ids = readIds(businessId)
  ids.add(key)
  writeIds(businessId, ids)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APPOINTMENTS_PANEL_DISMISSED_EVENT))
  }
}

export function isAppointmentDismissedFromPanel(
  appointmentId: string,
  businessId?: string | null,
): boolean {
  const tid = appointmentId.trim()
  if (!tid) return false
  const ids = readIds(businessId)
  const canonical = normalizePanelDismissId(tid)
  return ids.has(canonical) || ids.has(tid)
}

export function filterDismissedAppointments<T extends { id: string }>(
  rows: T[],
  businessId?: string | null,
): T[] {
  const ids = readIds(businessId)
  if (ids.size === 0) return rows
  return rows.filter((row) => !isAppointmentDismissedFromPanel(row.id, businessId))
}
