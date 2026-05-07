export function coerceServiceIdValue(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (value != null && typeof value === "object" && "toString" in value) {
    return String((value as { toString: () => string }).toString()).trim()
  }
  return ""
}
