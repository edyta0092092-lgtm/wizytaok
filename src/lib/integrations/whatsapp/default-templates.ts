import type { WhatsAppIntegrationConfig, WhatsAppTemplateKind } from "@/lib/integrations/whatsapp/types"

const DEFAULT_BODIES: Record<WhatsAppTemplateKind, string> = {
  confirmation:
    "Cześć {{client_name}}! Potwierdzamy wizytę: {{service_name}} dnia {{appointment_date}} o {{appointment_time}}. Do zobaczenia!",
  reminder:
    "Przypomnienie: {{service_name}} {{appointment_date}} o {{appointment_time}}. {{client_name}}, czekamy na Ciebie!",
  cancellation:
    "{{client_name}}, wizyta {{service_name}} na {{appointment_date}} o {{appointment_time}} została anulowana.",
  thank_you:
    "Dziękujemy za wizytę, {{client_name}}! Mamy nadzieję, że {{service_name}} spełniła oczekiwania.",
}

export function defaultWhatsAppTemplates(): WhatsAppIntegrationConfig["templates"] {
  return (Object.keys(DEFAULT_BODIES) as WhatsAppTemplateKind[]).reduce(
    (acc, kind) => {
      acc[kind] = { kind, body: DEFAULT_BODIES[kind], enabled: true }
      return acc
    },
    {} as WhatsAppIntegrationConfig["templates"],
  )
}
