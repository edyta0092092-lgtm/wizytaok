import type { Language } from "@/lib/i18n/dictionaries"
import type { StatisticsRange } from "@/lib/statistics/statistics-types"

export function formatStatisticsRangeLabel(range: StatisticsRange, language: Language): string {
  const locale = language === "en" ? "en-US" : "pl-PL"
  const today = new Date()

  if (range.startsWith("month:")) {
    const [year, month] = range.slice("month:".length).split("-").map(Number)
    const label = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
      new Date(year, (month || 1) - 1, 1),
    )
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  if (range.startsWith("year:")) {
    return range.slice("year:".length)
  }

  const presets: Record<string, { pl: string; en: string }> = {
    "7d": { pl: "ostatnie 7 dni", en: "last 7 days" },
    "30d": { pl: "ostatnie 30 dni", en: "last 30 days" },
    "90d": { pl: "ostatnie 90 dni", en: "last 90 days" },
    "12m": { pl: "ostatnie 12 miesięcy", en: "last 12 months" },
  }
  const preset = presets[range]
  if (preset) return language === "en" ? preset.en : preset.pl

  return today.toISOString().slice(0, 10)
}
