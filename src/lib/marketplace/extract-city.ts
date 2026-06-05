/** Wyciąga miasto z adresu (heurystyka — docelowo pole `marketplace_city` w DB). */
export function extractCityFromAddress(address: string | null | undefined): string | null {
  if (!address?.trim()) return null
  const raw = address.trim()

  const postalCity = raw.match(/\d{2}-\d{3}\s+([^\d,]+)/i)
  if (postalCity?.[1]) {
    return postalCity[1].trim()
  }

  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!
    const cleaned = last.replace(/^\d{2}-\d{3}\s*/, "").trim()
    if (cleaned.length >= 2) return cleaned
  }

  return null
}

export function normalizeSearchToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
}
