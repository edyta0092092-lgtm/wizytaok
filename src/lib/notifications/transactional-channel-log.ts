import {
  upsertNotificationLog,
  type NotificationLogUpdatePatch,
} from "@/lib/notifications/notification-log-update"
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
): Promise<void> {
  await upsertNotificationLog(
    admin,
    { booking_id: booking.id, type: logType, channel },
    {
      business_id: booking.business_id,
      booking_id: booking.id,
      channel,
      type: logType,
      recipient,
      status: "pending",
      subject: null,
      body: null,
    },
    { ...patch, recipient },
    logTag,
  )
}
