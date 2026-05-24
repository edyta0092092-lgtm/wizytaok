import type { Appointment } from "@/types/domain"

const CACHE_TTL_MS = 25_000

type CacheEntry = {
  key: string
  at: number
  data: Appointment[]
}

let cache: CacheEntry | null = null

export function mergedAppointmentsCacheKey(businessId: string | null | undefined): string {
  return businessId?.trim() ? `bid:${businessId.trim()}` : "local"
}

export function getCachedMergedAppointments(key: string): Appointment[] | null {
  if (!cache || cache.key !== key) return null
  if (Date.now() - cache.at > CACHE_TTL_MS) {
    cache = null
    return null
  }
  return cache.data
}

export function setCachedMergedAppointments(key: string, data: Appointment[]): void {
  cache = { key, at: Date.now(), data }
}

export function invalidateMergedAppointmentsCache(): void {
  cache = null
}
