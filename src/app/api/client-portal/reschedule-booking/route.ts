import { NextResponse } from "next/server"

import { reschedulePublicBookingByToken } from "@/lib/bookings/reschedule-public-booking-server"
import { requireClientPortalSession } from "@/lib/client-portal/require-client-session-server"
import { notifyBookingRescheduledByClient } from "@/lib/notifications/booking-rescheduled-by-client-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  bookingId?: string
  date?: string
  time?: string
  language?: "pl" | "en"
}

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
  const date = typeof body.date === "string" ? body.date.trim().slice(0, 10) : ""
  const time = typeof body.time === "string" ? body.time.trim() : ""
  if (!bookingId || !date || !time) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unconfigured" }, { status: 500 })
  }

  const { data: bookingRow } = await admin
    .from("bookings")
    .select("id,client_email,confirmation_token")
    .eq("id", bookingId)
    .maybeSingle()

  if (!bookingRow) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  if (String(bookingRow.client_email ?? "").trim().toLowerCase() !== auth.ctx.email) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const token = String(bookingRow.confirmation_token ?? "").trim()
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_missing" }, { status: 409 })
  }

  const rescheduleRes = await reschedulePublicBookingByToken(admin, token, date, time)
  if (!rescheduleRes.ok) {
    const status =
      rescheduleRes.error === "slot_unavailable" || rescheduleRes.error === "same_slot"
        ? 409
        : 500
    return NextResponse.json({ ok: false, error: rescheduleRes.error }, { status })
  }

  const { data: business } = await admin
    .from("business_profiles")
    .select("slug,phone,contact_phone,business_name,business_address")
    .eq("id", rescheduleRes.booking.business_id)
    .maybeSingle()

  if (business) {
    await notifyBookingRescheduledByClient({
      booking: rescheduleRes.booking,
      business,
      language: body.language === "en" ? "en" : "pl",
    })
  }

  return NextResponse.json({ ok: true })
}
