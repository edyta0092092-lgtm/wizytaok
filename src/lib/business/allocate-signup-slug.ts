import {
  DEMO_BOOKING_SLUG,
  isValidPublicSlugFormat,
  normalizePublicSlug,
  PUBLIC_SLUG_MAX_LENGTH,
  PUBLIC_SLUG_MIN_LENGTH,
} from "@/lib/business/slug"
import { checkBusinessSlugAvailability } from "@/lib/supabase/repositories/business-profile.repository"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

function randomSlugSegment(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toLowerCase()
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8)
}

function truncateSlugRoot(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s.replace(/-+$/g, "")
  let t = s.slice(0, maxLen).replace(/-+$/g, "")
  const li = t.lastIndexOf("-")
  if (li >= PUBLIC_SLUG_MIN_LENGTH) t = t.slice(0, li)
  return t
}

/** Miejsce na „-xxxxxxxx” przy kolizji nazwy. */
const SLUG_COLLISION_SUFFIX_ROOM = 9

function coerceValidSignupSlugRoot(businessNameTrimmed: string): string {
  let s = normalizePublicSlug(businessNameTrimmed)
  s = truncateSlugRoot(s, PUBLIC_SLUG_MAX_LENGTH - SLUG_COLLISION_SUFFIX_ROOM)

  let guard = 0
  while (
    (!isValidPublicSlugFormat(s) || s === DEMO_BOOKING_SLUG) &&
    guard < 10
  ) {
    s = truncateSlugRoot(`firma-${randomSlugSegment()}`, PUBLIC_SLUG_MAX_LENGTH - SLUG_COLLISION_SUFFIX_ROOM)
    guard += 1
  }

  if (!isValidPublicSlugFormat(s) || s === DEMO_BOOKING_SLUG) {
    return `firma-${randomSlugSegment()}`
  }

  return s
}

/** Wybiera wolny publiczny slug po nazwie firmy (bez pola w formularzu). */
export async function allocateSignupBookingSlug(client: SupabaseClient<Database>, businessName: string) {
  const root = coerceValidSignupSlugRoot(businessName.trim())
  const candidates: string[] = [root]

  for (let i = 0; i < 40; i += 1) {
    const augmented = truncateSlugRoot(
      `${root}-${randomSlugSegment()}`,
      PUBLIC_SLUG_MAX_LENGTH,
    )
    if (isValidPublicSlugFormat(augmented) && augmented !== DEMO_BOOKING_SLUG) {
      candidates.push(augmented)
    }
  }

  const unique = [...new Set(candidates)].filter(
    (c) => c !== DEMO_BOOKING_SLUG && isValidPublicSlugFormat(c),
  )

  for (const candidate of unique) {
    const slugCheck = await checkBusinessSlugAvailability(client, candidate)
    if (slugCheck.error) {
      return { ok: false as const, code: "check_failed" as const }
    }
    if (slugCheck.available === true) {
      return { ok: true as const, slug: candidate }
    }
  }

  return { ok: false as const, code: "exhausted" as const }
}
