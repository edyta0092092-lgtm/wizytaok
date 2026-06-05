import type { LoyaltyProgramConfig, LoyaltyProgramKind } from "@/lib/loyalty/loyalty-types"

const STORAGE_KEY = "wizytaok-loyalty-program-v1"

export const DEFAULT_LOYALTY_PROGRAM = (businessId: string): LoyaltyProgramConfig => ({
  businessId,
  enabled: false,
  kind: "visits_reward",
  visitsForReward: 5,
  rewardPercent: 10,
  pointsPerCompletedVisit: 10,
  visitsForTier: 10,
  tierName: "VIP",
  updatedAt: new Date().toISOString(),
})

function isProgram(value: unknown): value is LoyaltyProgramConfig {
  if (!value || typeof value !== "object") return false
  const o = value as Partial<LoyaltyProgramConfig>
  const kinds: LoyaltyProgramKind[] = ["visits_reward", "points", "vip_tier"]
  return (
    typeof o.businessId === "string" &&
    typeof o.enabled === "boolean" &&
    kinds.includes(o.kind as LoyaltyProgramKind) &&
    typeof o.visitsForReward === "number" &&
    typeof o.rewardPercent === "number" &&
    typeof o.pointsPerCompletedVisit === "number" &&
    typeof o.visitsForTier === "number" &&
    typeof o.tierName === "string"
  )
}

export function readLoyaltyProgram(businessId: string): LoyaltyProgramConfig {
  if (typeof window === "undefined" || !businessId.trim()) {
    return DEFAULT_LOYALTY_PROGRAM(businessId)
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_LOYALTY_PROGRAM(businessId)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return DEFAULT_LOYALTY_PROGRAM(businessId)
    const record = parsed as Record<string, unknown>
    const entry = record[businessId]
    if (!isProgram(entry)) return DEFAULT_LOYALTY_PROGRAM(businessId)
    return entry
  } catch {
    return DEFAULT_LOYALTY_PROGRAM(businessId)
  }
}

export function writeLoyaltyProgram(config: LoyaltyProgramConfig): void {
  if (typeof window === "undefined" || !config.businessId.trim()) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    let record: Record<string, LoyaltyProgramConfig> = {}
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object") {
        record = { ...(parsed as Record<string, LoyaltyProgramConfig>) }
      }
    }
    record[config.businessId] = {
      ...config,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record))
  } catch {
    // noop
  }
}
