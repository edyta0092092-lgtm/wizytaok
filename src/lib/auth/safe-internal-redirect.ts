/**
 * Zezwala na ścieżki względne tej samej aplikacji, także z query (np. /settings?stripe_test=success).
 * Odrzuca open redirect (//, pełne URL z ://).
 */
export function safeInternalRedirect(raw: string | null | undefined): string | null {
  if (raw == null) return null
  let s = raw.trim()
  if (!s) return null
  try {
    s = decodeURIComponent(s)
  } catch {
    return null
  }
  if (!s.startsWith("/") || s.startsWith("//")) return null
  if (s.includes("://")) return null
  return s
}

export function safeInternalRedirectOrDashboard(raw: string | null | undefined): string {
  return safeInternalRedirect(raw) ?? "/dashboard"
}
