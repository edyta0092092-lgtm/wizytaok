import type { Language } from "@/lib/i18n/dictionaries"

function polishVisitWord(count: number): string {
  const abs = Math.abs(count)
  const lastDigit = abs % 10
  const lastTwoDigits = abs % 100

  if (abs === 1) return "wizytę"
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return "wizyty"
  }
  return "wizyt"
}

export function formatTodayAppointmentsLabel(count: number, language: Language): string {
  if (language === "en") {
    const word = count === 1 ? "appointment" : "appointments"
    return `You have ${count} ${word} today.`
  }

  return `Dzisiaj masz ${count} ${polishVisitWord(count)}.`
}
