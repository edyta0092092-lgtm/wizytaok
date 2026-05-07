/**
 * Mapuje błąd techniczny na komunikat dla użytkownika końcowego.
 * Surową treść loguj w dev przez caller (np. console.info).
 */
export function extractErrorMessage(error: unknown): string {
  if (!error) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message || "")
  }
  try {
    return JSON.stringify(error)
  } catch {
    return ""
  }
}

function looksTechnical(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("schema cache") ||
    m.includes("supabase") ||
    m.includes(" rpc") ||
    m.includes("rpc ") ||
    m.includes("pgrst") ||
    m.includes("row-level security") ||
    m.includes("rls") ||
    (m.includes("column") && m.includes("does not exist")) ||
    (m.includes("relation") && m.includes("does not exist")) ||
    m.includes("permission denied") ||
    m.includes("jwt")
  )
}

/**
 * @param t — funkcja tłumaczenia; klucze: `errors.genericTryAgain`, `errors.technicalTryAgain`
 */
export function toUserFacingErrorMessage(
  error: unknown,
  t: (key: string) => string
): string {
  const raw = extractErrorMessage(error).trim()
  if (process.env.NODE_ENV !== "production" && raw) {
    console.info("[userFacingError.raw]", raw.slice(0, 500))
  }
  if (!raw) return t("errors.genericTryAgain")
  if (looksTechnical(raw)) return t("errors.technicalTryAgain")
  return raw.length > 200 ? t("errors.genericTryAgain") : raw
}
