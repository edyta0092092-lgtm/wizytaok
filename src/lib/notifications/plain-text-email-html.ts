import { buildBrandedBodyEmailHtml } from "@/lib/notifications/transactional-email-layout"

/**
 * Renderuje wolny tekst szablonu jako pełny, brandowany HTML maila (tło,
 * nagłówek WizytaOK, biała karta, stopka) — spójnie z pozostałymi mailami.
 */
export function plainTextEmailToHtml(
  body: string,
  opts?: { subject?: string; lang?: "pl" | "en" },
): string {
  const normalized = body.replace(/\r\n/g, "\n").trim()
  if (!normalized) return ""
  return buildBrandedBodyEmailHtml(normalized, opts)
}
