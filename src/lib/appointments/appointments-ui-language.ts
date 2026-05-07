/** Znormalizowany język UI dla podstron wizyt / list (tylko en | pl). */
export function appointmentsUiLanguage(language: string): "en" | "pl" {
  return language === "en" ? "en" : "pl"
}
