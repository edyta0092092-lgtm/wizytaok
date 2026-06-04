import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"

/** Ścieżka publicznej strony rezerwacji dla firmy (panel → umówienie wizyty). */
export function businessBookingPagePath(slug: string | null | undefined): string {
  const normalized = slug?.trim() ? normalizePublicSlug(slug.trim()) : ""
  if (!normalized || !isValidPublicSlugFormat(normalized)) {
    return "/rezerwacje"
  }
  return `/rezerwacje/${encodeURIComponent(normalized)}`
}
