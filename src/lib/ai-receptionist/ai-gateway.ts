import type { AiConversationMessage, AiReceptionistConfig } from "@/lib/ai-receptionist/types"

export type AiGatewayRequest = {
  businessId: string
  conversationId: string
  userMessage: string
  config: AiReceptionistConfig
  history: AiConversationMessage[]
}

export type AiGatewayResult =
  | { ok: true; skipped: true; reason: "foundation_ui_only" }
  | { ok: false; error: string }

/**
 * Bramka do modelu językowego — w fundamencie nie wywołuje OpenAI ani innych API.
 * Docelowo: OpenAI / Azure OpenAI z function calling (dostępność, rezerwacja).
 */
export async function requestAiReceptionistReply(
  _request: AiGatewayRequest,
): Promise<AiGatewayResult> {
  return { ok: true, skipped: true, reason: "foundation_ui_only" }
}
