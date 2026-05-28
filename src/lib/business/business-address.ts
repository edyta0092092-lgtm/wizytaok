export function normalizeBusinessAddress(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

export function isBusinessAddressEntryValid(
  address: string,
  placeId: string,
  options?: { requirePlaceId?: boolean },
): boolean {
  const normalized = normalizeBusinessAddress(address)
  if (normalized.length < 5) return false
  if (options?.requirePlaceId) {
    return placeId.trim().length > 0
  }
  return true
}
