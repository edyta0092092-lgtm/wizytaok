import type {
  WhatsAppTemplatePreviewContext,
  WhatsAppTemplateVariable,
} from "@/lib/integrations/whatsapp/types"

export const WHATSAPP_TEMPLATE_VARIABLES: WhatsAppTemplateVariable[] = [
  "client_name",
  "service_name",
  "appointment_date",
  "appointment_time",
]

/** Domyślne wartości do podglądu w UI. */
export const WHATSAPP_PREVIEW_SAMPLE: WhatsAppTemplatePreviewContext = {
  client_name: "Anna Kowalska",
  service_name: "Strzyżenie damskie",
  appointment_date: "2026-06-15",
  appointment_time: "14:30",
}

const VAR_PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/gi

/** Podstawia {{zmienne}} w treści szablonu (bez wysyłki). */
export function renderWhatsAppTemplate(
  body: string,
  context: WhatsAppTemplatePreviewContext,
): string {
  return body.replace(VAR_PATTERN, (_match, key: string) => {
    const k = key as WhatsAppTemplateVariable
    if (k in context) return context[k] ?? `{{${key}}}`
    return `{{${key}}}`
  })
}

export function whatsAppVariablePlaceholder(variable: WhatsAppTemplateVariable): string {
  return `{{${variable}}}`
}
