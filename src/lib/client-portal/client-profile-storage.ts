import type { ClientPortalProfile } from "@/lib/client-portal/types"

const STORAGE_KEY = "wizytaok-client-portal-profile-v1"

export function readClientPortalProfileLocal(userId: string): Partial<ClientPortalProfile> | null {
  if (typeof window === "undefined" || !userId.trim()) return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const record = JSON.parse(raw) as Record<string, Partial<ClientPortalProfile>>
    return record[userId] ?? null
  } catch {
    return null
  }
}

export function writeClientPortalProfileLocal(userId: string, profile: ClientPortalProfile): void {
  if (typeof window === "undefined" || !userId.trim()) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    let record: Record<string, ClientPortalProfile> = {}
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object") {
        record = { ...(parsed as Record<string, ClientPortalProfile>) }
      }
    }
    record[userId] = profile
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // noop
  }
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}
