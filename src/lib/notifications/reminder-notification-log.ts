import type { SupabaseClient } from "@supabase/supabase-js"

import { upsertNotificationLog } from "@/lib/notifications/notification-log-update"
import type { Database } from "@/types/database"

type AdminClient = SupabaseClient<Database>

export type ReminderLogType = "appointment_reminder_24h" | "appointment_reminder_short"

export function reminderLogTypeFromKind(kind: string): ReminderLogType {
  const k = kind.trim().toLowerCase()
  if (k === "second" || k === "appointment_reminder_short") return "appointment_reminder_short"
  return "appointment_reminder_24h"
}

export async function upsertReminderNotificationLog(
  admin: AdminClient,
  args: {
    businessId: string
    bookingId: string
    reminderKind: string
    channel: "email" | "sms"
    status: string
    recipient?: string | null
    subject?: string | null
    body?: string | null
    provider?: string | null
    providerMessageId?: string | null
    errorMessage?: string | null
    sentAt?: string | null
    timingMinutesBefore?: number | null
  },
  logTag = "[reminder.notify.log]",
): Promise<void> {
  const type = reminderLogTypeFromKind(args.reminderKind)
  const recipient = (args.recipient ?? "").trim()
  const timing_minutes_before =
    typeof args.timingMinutesBefore === "number" && Number.isFinite(args.timingMinutesBefore)
      ? Math.max(0, Math.floor(args.timingMinutesBefore))
      : args.timingMinutesBefore === null
        ? null
        : undefined
  await upsertNotificationLog(
    admin,
    { booking_id: args.bookingId, type, channel: args.channel },
    {
      business_id: args.businessId,
      booking_id: args.bookingId,
      channel: args.channel,
      type,
      recipient,
      status: args.status,
      subject: args.subject ?? null,
      body: args.body ?? null,
      provider: args.provider ?? null,
      provider_message_id: args.providerMessageId ?? null,
      error_message: args.errorMessage ?? null,
      sent_at: args.sentAt ?? null,
      ...(timing_minutes_before !== undefined ? { timing_minutes_before } : {}),
    },
    {
      status: args.status,
      recipient,
      subject: args.subject ?? null,
      body: args.body ?? null,
      provider: args.provider ?? null,
      provider_message_id: args.providerMessageId ?? null,
      error_message: args.errorMessage ?? null,
      sent_at: args.sentAt ?? null,
      ...(timing_minutes_before !== undefined ? { timing_minutes_before } : {}),
    },
    logTag,
  )
}
