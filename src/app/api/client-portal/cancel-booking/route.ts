import { NextResponse } from "next/server"

import { cancelPublicBookingById } from "@/lib/bookings/cancel-public-booking-server"
import { requireClientPortalSession } from "@/lib/client-portal/require-client-session-server"
import { notifyBookingCancelledByClient } from "@/lib/notifications/booking-cancelled-by-client-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = { bookingId?: string; language?: "pl" | "en" }

export async function POST(req: Request) {
  const auth = await requireClientPortalSession()
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : ""
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "booking_id_required" }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unconfigured" }, { status: 500 })
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id,client_email,status")
    .eq("id", bookingId)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  if (String(booking.client_email ?? "").trim().toLowerCase() !== auth.ctx.email) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true })
  }

  const result = await cancelPublicBookingById(admin, bookingId)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  const { data: fullBooking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle()
  if (fullBooking) {
    const { data: business } = await admin
      .from("business_profiles")
      .select("slug,phone,contact_phone,business_name,business_address")
      .eq("id", fullBooking.business_id)
      .maybeSingle()
    if (business) {
      await notifyBookingCancelledByClient({
        booking: fullBooking,
        business,
        language: body.language === "en" ? "en" : "pl",
      })
    }
  }

  return NextResponse.json({ ok: true })
}
