import type {
  AiReceptionistConfig,
  AiReceptionistStats,
} from "@/lib/ai-receptionist/types"

const CONFIG_KEY = "wizytaok-ai-receptionist-config-v1"
const STATS_KEY = "wizytaok-ai-receptionist-stats-v1"

export function defaultAiReceptionistConfig(businessId: string): AiReceptionistConfig {
  return {
    businessId,
    enabled: false,
    assistantName: "Zosia",
    tone: "friendly",
    language: "pl",
    updatedAt: new Date().toISOString(),
  }
}

export function defaultAiReceptionistStats(businessId: string): AiReceptionistStats {
  return {
    conversationCount: 0,
    bookingsFromAi: 0,
    updatedAt: new Date().toISOString(),
  }
}

function isConfig(value: unknown): value is AiReceptionistConfig {
  if (!value || typeof value !== "object") return false
  const o = value as Partial<AiReceptionistConfig>
  return (
    typeof o.businessId === "string" &&
    typeof o.enabled === "boolean" &&
    typeof o.assistantName === "string" &&
    (o.tone === "friendly" || o.tone === "professional" || o.tone === "concise") &&
    (o.language === "pl" || o.language === "en")
  )
}

function isStats(value: unknown): value is AiReceptionistStats {
  if (!value || typeof value !== "object") return false
  const o = value as Partial<AiReceptionistStats>
  return (
    typeof o.conversationCount === "number" &&
    typeof o.bookingsFromAi === "number"
  )
}

export function readAiReceptionistConfig(businessId: string): AiReceptionistConfig {
  if (typeof window === "undefined" || !businessId.trim()) {
    return defaultAiReceptionistConfig(businessId)
  }
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY)
    if (!raw) return defaultAiReceptionistConfig(businessId)
    const record = JSON.parse(raw) as Record<string, unknown>
    const entry = record[businessId]
    if (!isConfig(entry)) return defaultAiReceptionistConfig(businessId)
    return entry
  } catch {
    return defaultAiReceptionistConfig(businessId)
  }
}

export function writeAiReceptionistConfig(config: AiReceptionistConfig): void {
  if (typeof window === "undefined" || !config.businessId.trim()) return
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY)
    let record: Record<string, AiReceptionistConfig> = {}
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object") {
        record = { ...(parsed as Record<string, AiReceptionistConfig>) }
      }
    }
    record[config.businessId] = {
      ...config,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(CONFIG_KEY, JSON.stringify(record))
  } catch {
    // noop
  }
}

export function readAiReceptionistStats(businessId: string): AiReceptionistStats {
  if (typeof window === "undefined" || !businessId.trim()) {
    return defaultAiReceptionistStats(businessId)
  }
  try {
    const raw = window.localStorage.getItem(STATS_KEY)
    if (!raw) return defaultAiReceptionistStats(businessId)
    const record = JSON.parse(raw) as Record<string, unknown>
    const entry = record[businessId]
    if (!isStats(entry)) return defaultAiReceptionistStats(businessId)
    return entry
  } catch {
    return defaultAiReceptionistStats(businessId)
  }
}

export function writeAiReceptionistStats(stats: AiReceptionistStats & { businessId: string }): void {
  if (typeof window === "undefined" || !stats.businessId.trim()) return
  try {
    const raw = window.localStorage.getItem(STATS_KEY)
    let record: Record<string, AiReceptionistStats> = {}
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object") {
        record = { ...(parsed as Record<string, AiReceptionistStats>) }
      }
    }
    const { businessId, ...metrics } = stats
    record[businessId] = {
      ...metrics,
      updatedAt: new Date().toISOString(),
    }
    window.localStorage.setItem(STATS_KEY, JSON.stringify(record))
  } catch {
    // noop
  }
}
