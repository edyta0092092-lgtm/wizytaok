import type { User } from "@supabase/supabase-js"

export type OAuthOwnerNamePrefill = {
  firstName: string
  lastName: string
}

function pickString(...values: unknown[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim()
  }
  return ""
}

/** Imię i nazwisko z metadanych Google/Facebook / Supabase Auth. */
export function parseOwnerNameFromUserMetadata(
  meta: Record<string, unknown> | undefined,
): OAuthOwnerNamePrefill {
  const m = meta ?? {}
  const full = pickString(m.full_name, m.name)
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
      }
    }
    if (parts.length === 1) {
      return { firstName: parts[0] ?? "", lastName: "" }
    }
  }
  return {
    firstName: pickString(m.given_name, m.first_name),
    lastName: pickString(m.family_name, m.last_name),
  }
}

export function readAuthUserEmail(user: User | null | undefined): string {
  return user?.email?.trim() ?? ""
}
