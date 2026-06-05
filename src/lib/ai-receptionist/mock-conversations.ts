import type { AiConversationPreview } from "@/lib/ai-receptionist/types"

/** Przykładowa rozmowa do makiet UI (PL). */
export const DEMO_CONVERSATION_PL: AiConversationPreview = {
  id: "demo-pl",
  title: "Zapytanie o terminy",
  messages: [
    {
      id: "m1",
      role: "client",
      content: "Czy są wolne terminy jutro?",
      at: "2026-05-30T10:02:00.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content:
        "Tak, mamy wolne godziny jutro: 10:00, 12:30 i 15:00. Która usługa Cię interesuje?",
      at: "2026-05-30T10:02:08.000Z",
    },
    {
      id: "m3",
      role: "client",
      content: "Strzyżenie damskie o 12:30.",
      at: "2026-05-30T10:03:00.000Z",
    },
    {
      id: "m4",
      role: "assistant",
      content:
        "Świetnie. Proszę podać imię i numer telefonu — przygotuję rezerwację na jutro o 12:30 (strzyżenie damskie).",
      at: "2026-05-30T10:03:12.000Z",
    },
  ],
}

export const DEMO_CONVERSATION_EN: AiConversationPreview = {
  id: "demo-en",
  title: "Availability inquiry",
  messages: [
    {
      id: "m1",
      role: "client",
      content: "Do you have any openings tomorrow?",
      at: "2026-05-30T10:02:00.000Z",
    },
    {
      id: "m2",
      role: "assistant",
      content: "Yes — we have 10:00, 12:30, and 15:00 available tomorrow. Which service do you need?",
      at: "2026-05-30T10:02:08.000Z",
    },
  ],
}

export function pickDemoConversation(language: "pl" | "en"): AiConversationPreview {
  return language === "en" ? DEMO_CONVERSATION_EN : DEMO_CONVERSATION_PL
}
