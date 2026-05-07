export function normalizeSupabaseUrl(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\/rest\/v1\/?$/i, "")
}
