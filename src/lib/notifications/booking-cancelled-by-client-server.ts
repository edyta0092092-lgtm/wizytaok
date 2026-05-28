import { sendBookingCancelledConfirmation } from "@/lib/notifications/booking-cancelled-notify-shared"
import { getTemplateRuntime } from "@/lib/notifications/template-runtime"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { Tables } from "@/types/database"

export async function notifyBookingCancelledByClient(args: {
  booking: Tables<"bookings">
  business: Pick<
    Tables<"business_profiles">,
    "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
  >
  language: "pl" | "en"
}) {
  const admin = getServiceRoleClient()
  const booking = args.booking

  let staffNameRel: string | null = null
  const staffId =
    typeof (booking as { staff_id?: string | null }).staff_id === "string"
      ? ((booking as { staff_id?: string | null }).staff_id ?? "").trim()
      : ""
  if (admin && staffId) {
    const { data: staff } = await admin.from("staff_members").select("name").eq("id", staffId).maybeSingle()
    staffNameRel = staff?.name?.trim() || null
  }
  const staffDisplayName = getStaffDisplayName({ name: staffNameRel ?? booking.staff_name ?? "" })

  let messageOverrides = undefined
  let sendSms = true
  let sendEmail = true
  if (admin) {
    const template = await getTemplateRuntime(admin, booking.business_id, "booking_cancelled_by_client")
    sendSms = template.smsExists ? template.smsEnabled : true
    sendEmail = template.emailExists ? template.emailEnabled : true
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
    business: args.business,
    language: args.language,
    logType: "booking_cancelled_by_client",
    staffDisplayName,
    messageOverrides,
    sendSms,
    sendEmail,
  })
}
