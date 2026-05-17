export type ReminderUiLanguage = "pl" | "en"

function polishPluralUnit(
  count: number,
  forms: { one: string; few: string; many: string },
): string {
  const abs = Math.abs(count)
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (abs === 1) return forms.one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms.few
  return forms.many
}

/** Np. „48 godzin”, „1 godzinę”, „24 godziny” — do fraz „… przed wizytą”. */
export function formatHoursBeforeVisit(hours: number, language: ReminderUiLanguage): string {
  const value = Math.max(1, Math.floor(hours))
  if (language === "en") {
    return value === 1 ? "1 hour" : `${value} hours`
  }
  const unit = polishPluralUnit(value, {
    one: "godzinę",
    few: "godziny",
    many: "godzin",
  })
  return `${value} ${unit}`
}

/** Np. „2 godziny”, „30 minut”, „1 minutę” — do fraz „… przed wizytą”. */
export function formatMinutesBeforeVisit(minutes: number, language: ReminderUiLanguage): string {
  const value = Math.max(1, Math.floor(minutes))
  if (language === "en") {
    if (value === 1) return "1 minute"
    if (value === 60) return "1 hour"
    if (value % 60 === 0) {
      const hours = value / 60
      return hours === 1 ? "1 hour" : `${hours} hours`
    }
    return `${value} minutes`
  }
  if (value === 60) return "1 godzinę"
  if (value % 60 === 0) {
    return formatHoursBeforeVisit(value / 60, language)
  }
  const unit = polishPluralUnit(value, {
    one: "minutę",
    few: "minuty",
    many: "minut",
  })
  return `${value} ${unit}`
}
