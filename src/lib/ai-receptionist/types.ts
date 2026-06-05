/** Ton odpowiedzi asystenta (docelowo w promptach LLM). */
export type AiReceptionistTone = "friendly" | "professional" | "concise"

export type AiReceptionistLanguage = "pl" | "en"

export type AiReceptionistConfig = {
  businessId: string
  /** Czy moduł jest włączony dla firmy (UI / przyszły kanał na stronie rezerwacji). */
  enabled: boolean
  assistantName: string
  tone: AiReceptionistTone
  language: AiReceptionistLanguage
  updatedAt: string
}

export type AiReceptionistStats = {
  conversationCount: number
  bookingsFromAi: number
  updatedAt: string
}

export type AiConversationRole = "client" | "assistant"

export type AiConversationMessage = {
  id: string
  role: AiConversationRole
  content: string
  at: string
}

/** Podgląd rozmowy w panelu (makieta — bez zapisu w bazie). */
export type AiConversationPreview = {
  id: string
  title: string
  messages: AiConversationMessage[]
}

export type AiReceptionistWorkspace = {
  config: AiReceptionistConfig
  stats: AiReceptionistStats
}
