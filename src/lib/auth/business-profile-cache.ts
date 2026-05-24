/** Session cache for resolved business profile id (invalidated on auth change). */
let cachedBusinessProfileId: string | null | undefined

export function peekCachedBusinessProfileId(): string | null | undefined {
  return cachedBusinessProfileId
}

export function setCachedBusinessProfileId(id: string | null): void {
  cachedBusinessProfileId = id
}

export function invalidateCachedBusinessProfileId(): void {
  cachedBusinessProfileId = undefined
}
