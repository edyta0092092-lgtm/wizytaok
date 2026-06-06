import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"

/** Ścieżka publicznej strony rezerwacji dla firmy (panel → umówienie wizyty). */
export function businessBookingPagePath(slug: string | null | undefined): string {
  const normalized = slug?.trim() ? normalizePublicSlug(slug.trim()) : ""
  if (!normalized || !isValidPublicSlugFormat(normalized)) {
    return "/rezerwacje"
  }
  return `/rezerwacje/${encodeURIComponent(normalized)}`
}

/** Origin do podglądu i kopiowania linku rezerwacji (preferuje domenę produkcyjną). */
export function getBookingPageDisplayOrigin(): string {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.APP_ORIGIN?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  if (typeof window !== "undefined") {
    const host = window.location.hostname
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return window.location.origin.replace(/\/$/, "")
    }
  }
  return "https://wizytaok.pl"
}

/** Pełny publiczny URL strony rezerwacji (do kopiowania i podglądu). */
export function businessBookingPageUrl(slug: string | null | undefined): string {
  const normalized = slug?.trim() ? normalizePublicSlug(slug.trim()) : ""
  if (!normalized || !isValidPublicSlugFormat(normalized)) {
    return `${getBookingPageDisplayOrigin()}/rezerwacje`
  }
  return `${getBookingPageDisplayOrigin()}/rezerwacje/${encodeURIComponent(normalized)}`
}

/** Fragment slug w podglądzie URL, gdy slug jest pusty lub niepoprawny. */
export const BOOKING_SLUG_PREVIEW_PLACEHOLDER = "twoj-adres"

export function bookingSlugPreviewSegment(slug: string | null | undefined): string {
  const normalized = slug?.trim() ? normalizePublicSlug(slug.trim()) : ""
  if (!normalized || !isValidPublicSlugFormat(normalized)) {
    return BOOKING_SLUG_PREVIEW_PLACEHOLDER
  }
  return normalized
}
