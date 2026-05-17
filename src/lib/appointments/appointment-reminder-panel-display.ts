import type { Tables } from "@/types/database"
import type { BusinessReminderChannelPersisted } from "@/types/domain"

export type AppointmentReminderQueueRow = Pick<
  Tables<"appointment_reminders">,
  "appointment_id" | "channel" | "reminder_kind" | "status"
>

export type AppointmentReminderPanelLabels = {
  automatedPolicy: string
  noReminders: string
  firstTitle: string
  secondTitle: string
  channelEmail: string
  channelSms: string
  statusPending: string
  statusSent: string
  statusFailed: string
  statusCancelled: string
  statusSkipped: string
  statusProcessing: string
  reminderChannel: BusinessReminderChannelPersisted
  secondReminderEnabled: boolean
}

export type AppointmentReminderChannelLine = {
  channelLabel: string
  statusLabel: string
}

export type AppointmentReminderSection = {
  title: string
  channels: AppointmentReminderChannelLine[]
}

function normalizeToken(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase()
}

export function appointmentReminderQueueStatusLabel(
  status: string | null | undefined,
  labels: AppointmentReminderPanelLabels,
): string {
  switch (normalizeToken(status)) {
    case "sent":
      return labels.statusSent
    case "failed":
      return labels.statusFailed
    case "cancelled":
      return labels.statusCancelled
    case "skipped":
      return labels.statusSkipped
    case "processing":
      return labels.statusProcessing
    case "pending":
    default:
      return labels.statusPending
  }
}

function channelLine(
  rows: AppointmentReminderQueueRow[],
  channel: "email" | "sms",
  channelLabel: string,
  labels: AppointmentReminderPanelLabels,
): AppointmentReminderChannelLine | null {
  const row = rows.find((r) => normalizeToken(r.channel) === channel)
  if (!row) return null
  return {
    channelLabel,
    statusLabel: appointmentReminderQueueStatusLabel(row.status, labels),
  }
}

function sectionFromRows(
  title: string,
  rows: AppointmentReminderQueueRow[],
  labels: AppointmentReminderPanelLabels,
): AppointmentReminderSection | null {
  if (rows.length === 0) return null
  const channels: AppointmentReminderChannelLine[] = []
  const ch = labels.reminderChannel
  if (ch === "email" || ch === "both") {
    const email = channelLine(rows, "email", labels.channelEmail, labels)
    if (email) channels.push(email)
  }
  if (ch === "sms" || ch === "both") {
    const sms = channelLine(rows, "sms", labels.channelSms, labels)
    if (sms) channels.push(sms)
  }
  if (channels.length === 0) return null
  return { title, channels }
}

export function buildAppointmentReminderSections(
  rows: AppointmentReminderQueueRow[],
  labels: AppointmentReminderPanelLabels,
): AppointmentReminderSection[] {
  const first = rows.filter((r) => normalizeToken(r.reminder_kind) === "first")
  const second = labels.secondReminderEnabled
    ? rows.filter((r) => normalizeToken(r.reminder_kind) === "second")
    : []
  const sections: AppointmentReminderSection[] = []
  const firstSection = sectionFromRows(labels.firstTitle, first, labels)
  if (firstSection) sections.push(firstSection)
  if (labels.secondReminderEnabled) {
    const secondSection = sectionFromRows(labels.secondTitle, second, labels)
    if (secondSection) sections.push(secondSection)
  }
  return sections
}

export function groupAppointmentReminderRowsByBookingId(
  rows: AppointmentReminderQueueRow[],
): Record<string, AppointmentReminderQueueRow[]> {
  const grouped: Record<string, AppointmentReminderQueueRow[]> = {}
  for (const row of rows) {
    const bookingId = String(row.appointment_id ?? "").trim()
    if (!bookingId) continue
    if (!grouped[bookingId]) grouped[bookingId] = []
    grouped[bookingId]!.push(row)
  }
  return grouped
}
