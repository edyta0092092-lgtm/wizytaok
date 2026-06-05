import type { LoyaltyRewardRecord } from "@/lib/loyalty/loyalty-types"

const STORAGE_KEY = "wizytaok-loyalty-rewards-v1"

function isReward(value: unknown): value is LoyaltyRewardRecord {
  if (!value || typeof value !== "object") return false
  const o = value as Partial<LoyaltyRewardRecord>
  return (
    typeof o.id === "string" &&
    typeof o.businessId === "string" &&
    typeof o.clientId === "string" &&
    typeof o.clientName === "string" &&
    typeof o.label === "string" &&
    typeof o.issuedAt === "string"
  )
}

export function readLoyaltyRewards(businessId: string): LoyaltyRewardRecord[] {
  if (typeof window === "undefined" || !businessId.trim()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isReward)
      .filter((r) => r.businessId === businessId)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
  } catch {
    return []
  }
}

export function readLoyaltyRewardsForClient(
  businessId: string,
  clientId: string,
): LoyaltyRewardRecord[] {
  return readLoyaltyRewards(businessId).filter((r) => r.clientId === clientId)
}

export function appendLoyaltyReward(reward: LoyaltyRewardRecord): void {
  if (typeof window === "undefined") return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    let all: LoyaltyRewardRecord[] = []
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) all = parsed.filter(isReward)
    }
    all.unshift(reward)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // noop
  }
}

export function allocateLoyaltyRewardId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `lr-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
