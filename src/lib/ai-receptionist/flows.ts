/**
 * Planowane przepływy rozmowy (fundament — bez implementacji LLM).
 * Docelowo: intent detection → slot lookup → create_booking RPC (bez zmiany public booking flow w MVP).
 */
export type AiReceptionistFlowId =
  | "availability_inquiry"
  | "book_appointment"
  | "reschedule"
  | "cancel"
  | "service_info"
  | "handoff_human"

export type AiReceptionistFlow = {
  id: AiReceptionistFlowId
  /** Klucz i18n: aiReceptionistPanel.flows.* */
  titleKey: string
  descriptionKey: string
}

export const AI_RECEPTIONIST_FLOWS: AiReceptionistFlow[] = [
  {
    id: "availability_inquiry",
    titleKey: "flowAvailabilityTitle",
    descriptionKey: "flowAvailabilityDesc",
  },
  {
    id: "book_appointment",
    titleKey: "flowBookTitle",
    descriptionKey: "flowBookDesc",
  },
  {
    id: "reschedule",
    titleKey: "flowRescheduleTitle",
    descriptionKey: "flowRescheduleDesc",
  },
  {
    id: "cancel",
    titleKey: "flowCancelTitle",
    descriptionKey: "flowCancelDesc",
  },
  {
    id: "service_info",
    titleKey: "flowServiceTitle",
    descriptionKey: "flowServiceDesc",
  },
  {
    id: "handoff_human",
    titleKey: "flowHandoffTitle",
    descriptionKey: "flowHandoffDesc",
  },
]
