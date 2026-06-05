export function formatCustomerDateTime(iso: string, language: "pl" | "en"): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const locale = language === "en" ? "en-GB" : "pl-PL"
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function formatCustomerDate(iso: string, language: "pl" | "en"): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  const locale = language === "en" ? "en-GB" : "pl-PL"
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}
