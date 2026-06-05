import { defaultWhatsAppTemplates } from "@/lib/integrations/whatsapp/default-templates"
import type { WhatsAppIntegrationConfig } from "@/lib/integrations/whatsapp/types"

const STORAGE_KEY = "wizytaok-whatsapp-integration-v1"

export function defaultWhatsAppConfig(businessId: string): WhatsAppIntegrationConfig {
  const now = new Date().toISOString()
  return {
    businessId,
    connected: false,
    provider: "meta",
    phoneNumber: "",
    templates: defaultWhatsAppTemplates(),
    stats: { sent: 0, delivered: 0, errors: 0, updatedAt: now },
    updatedAt: now,
  }
}

function isConfig(value: unknown): value is WhatsAppIntegrationConfig {
  if (!value || typeof value !== "object") return false
  const o = value as Partial<WhatsAppIntegrationConfig>
  return (
    typeof o.businessId === "string" &&
    typeof o.connected === "boolean" &&
    (o.provider === "meta" || o.provider === "twilio" || o.provider === "other") &&
    typeof o.phoneNumber === "string" &&
    o.templates !== null &&
    typeof o.templates === "object"
  )
}

export function readWhatsAppConfig(businessId: string): WhatsAppIntegrationConfig {
  if (typeof window === "undefined" || !businessId.trim()) {
    return defaultWhatsAppConfig(businessId)
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultWhatsAppConfig(businessId)
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return defaultWhatsAppConfig(businessId)
    const record = parsed as Record<string, unknown>
    const entry = record[businessId]
    if (!isConfig(entry)) return defaultWhatsAppConfig(businessId)
    return {
      ...defaultWhatsAppConfig(businessId),
      ...entry,
      templates: { ...defaultWhatsAppTemplates(), ...entry.templates },
      stats: {
        ...defaultWhatsAppConfig(businessId).stats,
        ...(entry.stats ?? {}),
      },
    }
  } catch {
    return defaultWhatsAppConfig(businessId)
  }
}

export function writeWhatsAppConfig(config: WhatsAppIntegrationConfig): void {
  if (typeof window === "undefined" || !config.businessId.trim()) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    let record: Record<string, WhatsAppIntegrationConfig> = {}
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === "object") {
        record = { ...(parsed as Record<string, WhatsAppIntegrationConfig>) }
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
