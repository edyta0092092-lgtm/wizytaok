/** Slug publiczny: małe litery, cyfry, myślniki (bez podwójnych myślników na brzegach). */
export const PUBLIC_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const PUBLIC_SLUG_MIN_LENGTH = 3
export const PUBLIC_SLUG_MAX_LENGTH = 50

/** Zarezerwowany slug demo - zawsze działa jak dotychczasowy mock (localStorage). */
export const DEMO_BOOKING_SLUG = "studio-potwierdzen"

export function normalizePublicSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function isValidPublicSlugFormat(slug: string): boolean {
  if (slug.length < PUBLIC_SLUG_MIN_LENGTH || slug.length > PUBLIC_SLUG_MAX_LENGTH) {
    return false
  }
  return PUBLIC_SLUG_REGEX.test(slug)
}
