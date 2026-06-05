import type { MarketingCampaign } from "@/lib/marketing/marketing-types"

const STORAGE_KEY = "wizytaok-marketing-campaigns-v1"

function isCampaign(value: unknown): value is MarketingCampaign {
  if (!value || typeof value !== "object") return false
  const o = value as Partial<MarketingCampaign>
  return (
    typeof o.id === "string" &&
    typeof o.businessId === "string" &&
    typeof o.name === "string" &&
    (o.channel === "sms" || o.channel === "email") &&
    (o.status === "draft" || o.status === "sent") &&
    typeof o.audienceSegment === "string" &&
    typeof o.messageBody === "string" &&
    typeof o.recipientCount === "number" &&
    typeof o.createdAt === "string"
  )
}

export function readMarketingCampaigns(businessId: string): MarketingCampaign[] {
  if (typeof window === "undefined" || !businessId.trim()) return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isCampaign)
      .filter((c) => c.businessId === businessId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  } catch {
    return []
  }
}

export function writeMarketingCampaigns(businessId: string, campaigns: MarketingCampaign[]): void {
  if (typeof window === "undefined" || !businessId.trim()) return
  try {
    const allRaw = window.localStorage.getItem(STORAGE_KEY)
    let all: MarketingCampaign[] = []
    if (allRaw) {
      const parsed = JSON.parse(allRaw) as unknown
      if (Array.isArray(parsed)) {
        all = parsed.filter(isCampaign).filter((c) => c.businessId !== businessId)
      }
    }
    const merged = [...campaigns.filter((c) => c.businessId === businessId), ...all]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // noop
  }
}

export function allocateMarketingCampaignId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `mc-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
