import {
  updateNotificationLogRow,
  type NotificationLogUpdatePatch,
} from "@/lib/notifications/notification-log-update"
import {
  forcePersistSentNotificationLog,
  insertNotificationLog,
  toNotificationLogInsertRow,
} from "@/lib/notifications/notification-log-insert"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database"

type LogAdmin = SupabaseClient<Database>

/**
 * Zapis historii wysyłki transakcyjnej (jak potwierdzenie / follow-up):
 * update istniejącego wiersza lub insert — bez wpisów „zaplanowanych”.
 */
export async function persistTransactionalChannelLog(
  admin: LogAdmin,
  booking: Pick<Tables<"bookings">, "id" | "business_id">,
  logType: string,
  channel: "sms" | "email",
  recipient: string,
  patch: NotificationLogUpdatePatch,
  logTag: string,
): Promise<boolean> {
  const status = String(patch.status ?? "").trim().toLowerCase()
  const hasContent = Boolean(patch.body?.trim()) || Boolean(recipient.trim())
  const persistAsSent =
    status === "sent" ||
    (hasContent && status !== "failed" && status !== "not_configured")

  if (persistAsSent) {
    const row = toNotificationLogInsertRow({
      business_id: booking.business_id,
      booking_id: booking.id,
      channel,
      type: logType,
      recipient,
      status: "sent",
      subject: patch.subject ?? null,
      body: patch.body ?? null,
      provider: patch.provider ?? null,
      provider_message_id: patch.provider_message_id ?? null,
      error_message: patch.error_message ?? patch.error ?? null,
      sent_at: patch.sent_at ?? new Date().toISOString(),
    })
    const ok = await forcePersistSentNotificationLog(admin, row, logTag)
    if (!ok) {
      console.error(logTag, {
        phase: "persist_sent_failed",
        booking_id: booking.id,
        type: logType,
        channel,
      })
    }
    return ok
  }

  const updated = await updateNotificationLogRow(
    admin,
    { booking_id: booking.id, type: logType, channel },
    { ...patch, recipient },
    logTag,
  )
  if (updated.ok && updated.updated) return true

  const inserted = await insertNotificationLog(
    admin,
    toNotificationLogInsertRow({
      business_id: booking.business_id,
      booking_id: booking.id,
      channel,
      type: logType,
      recipient,
      status: patch.status,
      subject: patch.subject ?? null,
      body: patch.body ?? null,
      provider: patch.provider ?? null,
      provider_message_id: patch.provider_message_id ?? null,
      error_message: patch.error_message ?? patch.error ?? null,
      sent_at: patch.sent_at ?? null,
    }),
    logTag,
  )
  if (!inserted.ok) {
    console.error(logTag, {
      phase: "persist_insert_failed",
      booking_id: booking.id,
      type: logType,
      channel,
      status: patch.status,
      message: inserted.message,
    })
    return false
  }
  return true
}
