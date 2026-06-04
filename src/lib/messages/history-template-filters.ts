/** Standardowe typy z sekcji „Szablony wiadomości” (kolejność jak na karcie). */
export const STANDARD_MESSAGE_TEMPLATE_TYPES = [
  "reminder_24h",
  "reminder_before_visit",
  "booking_confirmation",
  "booking_cancelled_by_company",
  "no_show_follow_up",
  "thank_you_after_visit",
] as const

export type StandardMessageTemplateType = (typeof STANDARD_MESSAGE_TEMPLATE_TYPES)[number]

const CUSTOM_TEMPLATE_FILTER_PREFIX = "custom_template:"

export function customTemplateFilterKey(templateId: string): string {
  return `${CUSTOM_TEMPLATE_FILTER_PREFIX}${templateId}`
}

export function isCustomTemplateFilterKey(value: string): boolean {
  return value.startsWith(CUSTOM_TEMPLATE_FILTER_PREFIX)
}

export function customTemplateIdFromFilterKey(value: string): string {
  return value.slice(CUSTOM_TEMPLATE_FILTER_PREFIX.length)
}

/** Własny szablon „zdarzenie” → typ jak w standardowych szablonach (filtr historii). */
export function historyTypeForCustomEventTemplate(args: {
  trigger_type?: string | null
  event_key?: string | null
}): StandardMessageTemplateType | null {
  if (String(args.trigger_type ?? "").trim() !== "event") return null
  const key = String(args.event_key ?? "").trim()
  if (key === "cancelled") return "booking_cancelled_by_company"
  if (key === "no_show") return "no_show_follow_up"
  if (key === "confirmed" || key === "created") return "booking_confirmation"
  return null
}
