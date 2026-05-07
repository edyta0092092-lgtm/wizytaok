import { dictionaries, type Language } from "@/lib/i18n/dictionaries"

/** Dwie wartości używane w UI i filtrach (dane w DB mogą mieć starsze warianty). */
export type UiBookingSource = "online" | "manual"

function dictLookup(locale: Language, path: string): string {
  const parts = path.split(".")
  let cur: unknown = dictionaries[locale]
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return path
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === "string" ? cur : path
}

/**
 * Normalizacja źródła do dwóch kategorii UI.
 * online zostaje online; manual, manual_admin, manual_staff, null i nieznane -> manual.
 */
export function normalizeBookingSource(raw: string | null | undefined): UiBookingSource {
  if (raw == null || String(raw).trim() === "") return "manual"
  const s = String(raw).trim()
  if (s === "online") return "online"
  return "manual"
}

export function isOnlineBookingSource(raw: string | null | undefined): boolean {
  return normalizeBookingSource(raw) === "online"
}

export function isManualBookingSource(raw: string | null | undefined): boolean {
  return normalizeBookingSource(raw) === "manual"
}

/** Stonowany zestaw: online lekko wyróżnione, reszta neutralna - pasuje do badge źródła. */
export function getBookingSourceTone(raw: string | null | undefined): "info" | "neutral" {
  return isOnlineBookingSource(raw) ? "info" : "neutral"
}

export function getBookingSourceLabel(raw: string | null | undefined, locale: Language): string {
  const n = normalizeBookingSource(raw)
  return dictLookup(
    locale,
    n === "online" ? "appointments.bookingSource.onlineBooking" : "appointments.bookingSource.addedManually"
  )
}

export function getBookingSourceShortLabel(raw: string | null | undefined, locale: Language): string {
  const n = normalizeBookingSource(raw)
  return dictLookup(
    locale,
    n === "online" ? "appointments.bookingSource.shortOnline" : "appointments.bookingSource.shortManual"
  )
}

export type AppointmentSourceFilter = "all" | "online" | "manual"

export function appointmentMatchesSourceFilter(
  raw: string | null | undefined,
  filter: AppointmentSourceFilter
): boolean {
  if (filter === "all") return true
  const n = normalizeBookingSource(raw)
  return n === filter
}

/** Klucz pod `t()` dla eksportu CSV (pełna etykieta jak na liście). */
export function bookingSourceCsvLabelKey(raw: string | null | undefined): string {
  const n = normalizeBookingSource(raw)
  return n === "online"
    ? "appointments.bookingSource.onlineBooking"
    : "appointments.bookingSource.addedManually"
}
