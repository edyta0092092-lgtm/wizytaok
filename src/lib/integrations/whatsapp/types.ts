/** Dostawca API WhatsApp Business (rozszerzalny). */
export type WhatsAppProvider = "meta" | "twilio" | "other"

export type WhatsAppTemplateKind = "confirmation" | "reminder" | "cancellation" | "thank_you"

export type WhatsAppTemplate = {
  kind: WhatsAppTemplateKind
  body: string
  enabled: boolean
}

/** Zmienne dostępne w szablonach (podgląd / przyszłe wysyłki). */
export type WhatsAppTemplateVariable =
  | "client_name"
  | "service_name"
  | "appointment_date"
  | "appointment_time"

export type WhatsAppDeliveryStats = {
  sent: number
  delivered: number
  errors: number
  /** Ostatnia aktualizacja liczników (MVP: lokalnie / demo). */
  updatedAt: string
}

export type WhatsAppIntegrationConfig = {
  businessId: string
  connected: boolean
  provider: WhatsAppProvider
  /** E.164 lub lokalny format — walidacja przy realnym API. */
  phoneNumber: string
  templates: Record<WhatsAppTemplateKind, WhatsAppTemplate>
  stats: WhatsAppDeliveryStats
  updatedAt: string
}

export type WhatsAppTemplatePreviewContext = Record<WhatsAppTemplateVariable, string>
