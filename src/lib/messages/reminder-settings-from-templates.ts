import type { BusinessReminderPanelSettings } from "@/lib/appointments/business-reminder-settings"
import type { Tables } from "@/types/database"
import type { BusinessReminderChannelPersisted } from "@/types/domain"

export const DEFAULT_FIRST_REMINDER_MINUTES = 24 * 60
export const DEFAULT_SECOND_REMINDER_MINUTES = 120

export const REMINDER_TIMING_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 15, label: "15 min przed" },
  { value: 30, label: "30 min przed" },
  { value: 60, label: "1 godzina przed" },
  { value: 120, label: "2 godziny przed" },
  { value: 180, label: "3 godziny przed" },
  { value: 360, label: "6 godzin przed" },
  { value: 720, label: "12 godzin przed" },
  { value: 1440, label: "24 godziny przed" },
  { value: 2880, label: "48 godzin przed" },
]

const REMINDER_TEMPLATE_ALIASES = {
  first: ["reminder_24h", "reminder", "first_reminder_24h", "appointment_reminder_24h"],
  second: ["reminder_before_visit", "second_reminder", "appointment_reminder_short"],
} as const

type TemplateRow = Pick<
  Tables<"message_templates">,
  "type" | "channel" | "status" | "timing_minutes_before"
>

function normalizeToken(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase()
}

function matchesReminderType(type: string, kind: keyof typeof REMINDER_TEMPLATE_ALIASES): boolean {
  const norm = normalizeToken(type)
  return REMINDER_TEMPLATE_ALIASES[kind].some((alias) => normalizeToken(alias) === norm)
}

function channelEnabled(
  rows: TemplateRow[],
  kind: keyof typeof REMINDER_TEMPLATE_ALIASES,
  channel: "sms" | "email",
  fallbackWhenMissing: boolean,
): boolean {
  const matched = rows.filter(
    (row) => matchesReminderType(String(row.type ?? ""), kind) && normalizeToken(row.channel) === channel,
  )
  if (matched.length === 0) return fallbackWhenMissing
  return matched.some((row) => row.status === "active")
}

function timingMinutesForKind(rows: TemplateRow[], kind: keyof typeof REMINDER_TEMPLATE_ALIASES): number | null {
  const matched = rows.filter((row) => matchesReminderType(String(row.type ?? ""), kind))
  for (const row of matched) {
    if (typeof row.timing_minutes_before === "number" && Number.isFinite(row.timing_minutes_before)) {
      return Math.max(0, Math.floor(row.timing_minutes_before))
    }
  }
  return null
}

export function deriveReminderChannel(args: {
  firstSms: boolean
  firstEmail: boolean
  secondSms: boolean
  secondEmail: boolean
}): BusinessReminderChannelPersisted {
  const sms = args.firstSms || args.secondSms
  const email = args.firstEmail || args.secondEmail
  if (sms && email) return "both"
  if (sms) return "sms"
  if (email) return "email"
  return "both"
}

export function parseReminderSettingsFromTemplateRows(
  rows: TemplateRow[],
): BusinessReminderPanelSettings & {
  firstReminderMinutes: number
  secondReminderMinutes: number
  defaultReminderMinutes: number
} {
  const firstReminderMinutes = timingMinutesForKind(rows, "first") ?? DEFAULT_FIRST_REMINDER_MINUTES
  const secondTiming = timingMinutesForKind(rows, "second")
  const firstSms = channelEnabled(rows, "first", "sms", true)
  const firstEmail = channelEnabled(rows, "first", "email", true)
  const secondSms = channelEnabled(rows, "second", "sms", true)
  const secondEmail = channelEnabled(rows, "second", "email", true)
  const secondReminderMinutes =
    secondTiming === 0 || (!secondSms && !secondEmail)
      ? 0
      : secondTiming ?? DEFAULT_SECOND_REMINDER_MINUTES

  const defaultReminderHours = Math.max(1, Math.ceil(firstReminderMinutes / 60))
  const reminderChannel = deriveReminderChannel({
    firstSms,
    firstEmail,
    secondSms,
    secondEmail,
  })

  return {
    defaultReminderHours,
    secondReminderMinutes,
    reminderChannel,
    firstReminderMinutes,
    defaultReminderMinutes: firstReminderMinutes,
  }
}

export function formatTimingLabel(minutes: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return ""
  const safe = Math.max(0, Math.floor(minutes))
  if (safe === 0) return "0 min"
  const h = Math.floor(safe / 60)
  const min = safe % 60
  if (h > 0 && min > 0) return `${h}h ${min}min`
  if (h > 0) return `${h}h`
  return `${min}min`
}

export function reminder24hTitleFromMinutes(minutes: number | null): string {
  const safe =
    typeof minutes === "number" && Number.isFinite(minutes)
      ? Math.max(0, Math.floor(minutes))
      : DEFAULT_FIRST_REMINDER_MINUTES
  if (safe > 0 && safe % 60 === 0) {
    return `Przypomnienie ${Math.floor(safe / 60)}h przed wizytą`
  }
  return `Przypomnienie ${formatTimingLabel(safe)} przed wizytą`
}
