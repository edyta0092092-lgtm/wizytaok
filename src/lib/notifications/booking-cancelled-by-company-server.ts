import {
  sendBookingCancelledConfirmation,
  type CancelNotifyLanguage,
} from "@/lib/notifications/booking-cancelled-notify-shared"
import { getTemplateRuntime } from "@/lib/notifications/template-runtime"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { Tables } from "@/types/database"

export type { CancelNotifyLanguage }

type BusinessRow = Pick<
  Tables<"business_profiles">,
  "id" | "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
>

/**
 * Po anulowaniu wizyty przez firmę — SMS i e-mail z potwierdzeniem „Wizyta odwołana”.
 */
export async function notifyBookingCancelledByCompany(args: {
  booking: Tables<"bookings">
  business: BusinessRow
  language: CancelNotifyLanguage
  /** Zachowane dla kompatybilności API — wysyłka nie jest już blokowana tym flagiem. */
  messagesEffectivelySent?: boolean
}): Promise<{ notice: "queued" | "sent" }> {
  void args.messagesEffectivelySent
  const admin = getServiceRoleClient()
  const { booking, business, language } = args

  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  let staffNameRel: string | null = null
  if (admin && staffId) {
    const { data: staff } = await admin.from("staff_members").select("name").eq("id", staffId).maybeSingle()
    staffNameRel = staff?.name?.trim() || null
  }
  const staffDisplayName = getStaffDisplayName({ name: staffNameRel ?? booking.staff_name ?? "" })

  let messageOverrides = undefined
  if (admin) {
    const template = await getTemplateRuntime(admin, business.id, "booking_cancelled_by_company")
    const hasCustom =
      (template.smsEnabled && template.smsBody) ||
      (template.emailEnabled && (template.emailSubject || template.emailBody))
    if (hasCustom) {
      messageOverrides = {
        smsBody: template.smsEnabled ? template.smsBody : null,
        emailSubject: template.emailEnabled ? template.emailSubject : null,
        emailBodyPlain: template.emailEnabled ? template.emailBody : null,
      }
    }
  }

  return sendBookingCancelledConfirmation({
    booking,
    business,
    language,
    logType: "booking_cancelled_by_company",
    staffDisplayName,
    messageOverrides,
  })
}

export function inferMessagesEffectivelySent(): boolean {
  const smsConfigured =
    Boolean(process.env.SMSAPI_TOKEN?.trim()) ||
    (Boolean(process.env.TWILIO_ACCOUNT_SID?.trim()) &&
      Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()) &&
      Boolean(process.env.TWILIO_FROM_NUMBER?.trim()))
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim())
  return smsConfigured || emailConfigured
}
