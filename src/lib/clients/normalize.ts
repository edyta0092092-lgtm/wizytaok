/** Normalizacja e-mail do dopasowywania klientów (spójnie z SQL `normalize_client_email`). */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (email == null) return null
  const t = email.trim().toLowerCase()
  return t.length > 0 ? t : null
}

/**
 * Normalizacja telefonu do dopasowywania (spójnie z SQL `normalize_client_phone`).
 * Polski numer bez prefiksu (9 cyfr) → +48…
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null
  const raw = phone.trim()
  if (!raw) return null
  const hasPlus = raw.startsWith("+")
  const digitsOnly = raw.replace(/\D/g, "")
  if (!digitsOnly) return null
  let d = digitsOnly
  if (!hasPlus) {
    if (d.length === 9) {
      d = `48${d}`
    } else if (d.length === 11 && d.startsWith("48")) {
      // ok
    } else if (d.length === 10 && d.startsWith("0")) {
      d = `48${d.slice(1)}`
    }
  }
  if (d.length === 11 && d.startsWith("48")) {
    return `+${d}`
  }
  if (hasPlus) {
    return `+${d}`
  }
  if (d.length >= 6) {
    return `+${d}`
  }
  return d
}
