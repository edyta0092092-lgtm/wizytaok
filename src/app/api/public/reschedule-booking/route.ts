import { NextResponse } from "next/server"

import { reschedulePublicBookingByToken } from "@/lib/bookings/reschedule-public-booking-server"
import { notifyBookingRescheduledByClient } from "@/lib/notifications/booking-rescheduled-by-client-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

type Body = {
  token?: string
  date?: string
  time?: string
  language?: "pl" | "en"
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  const date = typeof body.date === "string" ? body.date.trim().slice(0, 10) : ""
  const time = typeof body.time === "string" ? body.time.trim() : ""
  if (!token) return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  if (!date || !time) {
    return NextResponse.json({ ok: false, error: "date_time_required" }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  if (!admin) return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })

  const rescheduleRes = await reschedulePublicBookingByToken(admin, token, date, time)
  if (!rescheduleRes.ok) {
    const status =
      rescheduleRes.error === "booking_not_found"
        ? 404
        : rescheduleRes.error === "slot_unavailable" ||
            rescheduleRes.error === "same_slot" ||
            rescheduleRes.error === "booking_not_reschedulable"
          ? 409
          : 500
    return NextResponse.json({ ok: false, error: rescheduleRes.error }, { status })
  }

  const { data: business } = await admin
    .from("business_profiles")
    .select("slug,phone,contact_phone,business_name,business_address")
    .eq("id", rescheduleRes.booking.business_id)
    .maybeSingle()

  if (!business) return NextResponse.json({ ok: true, notice: "queued" })

  const result = await notifyBookingRescheduledByClient({
    booking: rescheduleRes.booking,
    business,
    language: body.language === "en" ? "en" : "pl",
  })

  return NextResponse.json({ ok: true, notice: result.notice })
}
