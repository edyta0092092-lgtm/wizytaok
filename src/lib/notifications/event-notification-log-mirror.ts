import { historyTypeForCustomEventTemplate } from "@/lib/messages/history-template-filters"
import { forcePersistSentNotificationLog } from "@/lib/notifications/notification-log-insert"
import type { CustomTemplateRow } from "@/lib/notifications/custom-template-send"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

type Admin = SupabaseClient<Database>

/**
 * Po wysłaniu własnego szablonu zdarzeniowego — lustrzany wpis w notification_logs,
 * żeby historia „Anulowanie wizyty” itd. działała tak samo jak dla szablonów standardowych.
 */
export async function mirrorEventCustomTemplateToNotificationLog(
  admin: Admin,
  args: {
    template: Pick<CustomTemplateRow, "trigger_type" | "event_key">
    businessId: string
    bookingId: string
    channel: "sms" | "email"
    recipient: string
    subject: string | null
    body: string
    provider: string | null
    providerMessageId: string | null
    sentAt: string
  },
): Promise<void> {
  const logType = historyTypeForCustomEventTemplate(args.template)
  if (!logType) return

  const ok = await forcePersistSentNotificationLog(
    admin,
    {
      business_id: args.businessId,
      booking_id: args.bookingId,
      type: logType,
      channel: args.channel,
      recipient: args.recipient,
      status: "sent",
      subject: args.subject,
      body: args.body,
      provider: args.provider,
      provider_message_id: args.providerMessageId,
      sent_at: args.sentAt,
    },
    "[event-custom-template.mirror-log]",
  )
  if (!ok) {
    console.error("[event-custom-template.mirror-log] persist_failed", {
      booking_id: args.bookingId,
      type: logType,
      channel: args.channel,
    })
  }
}
