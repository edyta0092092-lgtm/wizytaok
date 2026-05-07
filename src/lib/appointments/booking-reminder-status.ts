import type { Appointment } from "@/types/domain"
import type { Tables } from "@/types/database"

type NotificationLogRow = Pick<Tables<"notification_logs">, "status" | "type" | "channel">

export type ReminderLineKind = "reminder24h" | "reminderBeforeVisit"
export type ReminderUiStatus = "disabled" | "scheduled" | "sent" | "partial" | "failed" | "unsent"

export type BookingReminderStatus = {
  overall: ReminderUiStatus
  lines: Array<{ kind: ReminderLineKind; status: ReminderUiStatus }>
}

const FIRST_TYPES = new Set([
  "reminder_24h",
  "first_reminder_24h",
  "appointment_reminder_24h",
  "auto_reminder_24h",
  "automatic_24h_reminder",
])
const SECOND_TYPES = new Set(["second_reminder", "appointment_reminder_short", "reminder_before_visit"])

function normalize(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase()
}

function fromLogs(rows: NotificationLogRow[]): ReminderUiStatus | null {
  if (rows.length === 0) return null
  const statuses = rows.map((row) => normalize(row.status))
  if (statuses.includes("failed")) return "failed"
  if (statuses.includes("sent")) {
    if (statuses.includes("queued") || statuses.includes("scheduled") || statuses.includes("pending")) {
      return "partial"
    }
    return "sent"
  }
  if (statuses.includes("queued") || statuses.includes("scheduled") || statuses.includes("pending")) {
    return "scheduled"
  }
  return null
}

function resolveReminderDueAtMs(
  kind: ReminderLineKind,
  booking: Appointment,
): number | null {
  const explicitDueAt =
    kind === "reminder24h"
      ? booking.firstReminderDueAt ?? booking.reminderDueAt
      : booking.secondReminderDueAt
  if (explicitDueAt) {
    const ms = new Date(explicitDueAt).getTime()
    if (!Number.isNaN(ms)) return ms
  }
  const startMs = new Date(booking.startsAt).getTime()
  if (Number.isNaN(startMs)) return null
  return kind === "reminder24h" ? startMs - 24 * 60 * 60 * 1000 : startMs - 60 * 60 * 1000
}

function fallbackScheduleOnly(
  kind: ReminderLineKind,
  booking: Appointment,
): ReminderUiStatus {
  const dueMs = resolveReminderDueAtMs(kind, booking)
  if (dueMs == null) return "scheduled"
  return dueMs <= Date.now() ? "unsent" : "scheduled"
}

export function getBookingReminderStatus(
  bookingId: string,
  booking: Appointment,
  logs: NotificationLogRow[],
  remindersEnabled: boolean
): BookingReminderStatus {
  if (!remindersEnabled) {
    return { overall: "disabled", lines: [] }
  }

  const firstLogs = logs.filter((row) => FIRST_TYPES.has(normalize(row.type)))
  const secondLogs = logs.filter((row) => SECOND_TYPES.has(normalize(row.type)))

  // sent can only come from notification_logs.status === 'sent'
  const firstStatus = fromLogs(firstLogs) ?? fallbackScheduleOnly("reminder24h", booking)
  const hasSecondReminder =
    secondLogs.length > 0 ||
    Boolean(booking.secondReminderDueAt) ||
    Boolean(booking.secondReminderStatus) ||
    Boolean(booking.secondReminderSentAt)

  const lines: Array<{ kind: ReminderLineKind; status: ReminderUiStatus }> = [
    { kind: "reminder24h", status: firstStatus },
  ]

  if (hasSecondReminder) {
    // sent can only come from notification_logs.status === 'sent'
    const secondStatus = fromLogs(secondLogs) ?? fallbackScheduleOnly("reminderBeforeVisit", booking)
    lines.push({ kind: "reminderBeforeVisit", status: secondStatus })
  }

  const lineStatuses = lines.map((line) => line.status)
  let overall: ReminderUiStatus = "scheduled"
  if (lineStatuses.includes("failed")) {
    overall = "failed"
  } else if (lineStatuses.includes("partial")) {
    overall = "partial"
  } else if (lineStatuses.every((status) => status === "sent")) {
    overall = "sent"
  } else if (lineStatuses.includes("unsent")) {
    overall = "unsent"
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[booking.reminder.status]", {
      bookingId,
      reminder24h: lines.find((line) => line.kind === "reminder24h")?.status ?? null,
      reminderBeforeVisit: lines.find((line) => line.kind === "reminderBeforeVisit")?.status ?? null,
      logs,
    })
  }

  return { overall, lines }
}
