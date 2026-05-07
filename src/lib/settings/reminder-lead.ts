const SETTINGS_STORAGE_KEY = "pw_settings_form_v2"

export type ReminderLeadSetting = "2h" | "6h" | "12h" | "24h" | "48h"
export type SecondReminderSetting = "disabled" | "30m" | "1h" | "2h" | "3h"

export function reminderLeadToHours(lead: string): number {
  switch (lead) {
    case "2h":
      return 2
    case "6h":
      return 6
    case "12h":
      return 12
    case "48h":
      return 48
    case "24h":
    default:
      return 24
  }
}

export function hoursToReminderLead(hours: number): ReminderLeadSetting {
  if (hours === 2) return "2h"
  if (hours === 6) return "6h"
  if (hours === 12) return "12h"
  if (hours === 48) return "48h"
  return "24h"
}

export function secondReminderToMinutes(value: string): number {
  switch (value) {
    case "30m":
      return 30
    case "1h":
      return 60
    case "3h":
      return 180
    case "disabled":
      return 0
    case "2h":
    default:
      return 120
  }
}

export function minutesToSecondReminder(minutes: number): SecondReminderSetting {
  if (minutes === 0) return "disabled"
  if (minutes === 30) return "30m"
  if (minutes === 60) return "1h"
  if (minutes === 180) return "3h"
  return "2h"
}

/** Odczyt z localStorage (tylko w przeglądarce); domyślnie 24h. */
export function readReminderLeadHoursFromBrowser(): number {
  if (typeof window === "undefined") return 24
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return 24
    const parsed = JSON.parse(raw) as { reminderLead?: string }
    return reminderLeadToHours(typeof parsed.reminderLead === "string" ? parsed.reminderLead : "24h")
  } catch {
    return 24
  }
}
