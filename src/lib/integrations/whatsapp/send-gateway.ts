import type { WhatsAppIntegrationConfig, WhatsAppTemplateKind } from "@/lib/integrations/whatsapp/types"

export type WhatsAppSendRequest = {
  businessId: string
  bookingId: string
  templateKind: WhatsAppTemplateKind
  toPhone: string
}

export type WhatsAppSendResult =
  | { ok: true; queued: false; reason: "foundation_ui_only" }
  | { ok: false; error: string }

/**
 * Bramka wysyłki WhatsApp — w MVP nie wywołuje zewnętrznego API.
 * Docelowo: Meta Cloud API / Twilio → webhook statusów → `whatsapp_message_deliveries`.
 */
export async function sendWhatsAppMessage(
  _config: WhatsAppIntegrationConfig,
  _request: WhatsAppSendRequest,
): Promise<WhatsAppSendResult> {
  return { ok: true, queued: false, reason: "foundation_ui_only" }
}
