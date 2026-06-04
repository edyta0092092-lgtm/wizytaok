/** Standardowe typy z sekcji „Szablony wiadomości” (kolejność jak na karcie). */
export const STANDARD_MESSAGE_TEMPLATE_TYPES = [
  "reminder_24h",
  "reminder_before_visit",
  "booking_confirmation",
  "booking_cancelled_by_company",
  "no_show_follow_up",
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
