import { sendBookingRescheduledConfirmation } from "@/lib/notifications/booking-rescheduled-notify-shared"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { Tables } from "@/types/database"

export async function notifyBookingRescheduledByClient(args: {
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

  return sendBookingRescheduledConfirmation({
    booking,
    business: args.business,
    language: args.language,
    logType: "booking_rescheduled_by_client",
    staffDisplayName,
  })
}
