import { NextResponse } from "next/server"

import { cancelPublicBookingByToken } from "@/lib/bookings/cancel-public-booking-server"
import { notifyBookingCancelledByClient } from "@/lib/notifications/booking-cancelled-by-client-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

type Body = {
  token?: string
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
  if (!token) return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  const admin = getServiceRoleClient()
  if (!admin) return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })

  const cancelRes = await cancelPublicBookingByToken(admin, token)
  if (!cancelRes.ok) {
    if (process.env.NODE_ENV === "development") {
      console.error("[cancel-booking]", cancelRes.error)
    }
    return NextResponse.json({ ok: false, error: cancelRes.error }, { status: 500 })
  }

  const bookingId = cancelRes.bookingId

  const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle()
  if (!booking) return NextResponse.json({ ok: true, notice: "queued" })

  const { data: business } = await admin
    .from("business_profiles")
    .select("slug,phone,contact_phone,business_name,business_address")
    .eq("id", booking.business_id)
    .maybeSingle()

  if (!business) return NextResponse.json({ ok: true, notice: "queued" })

  const result = await notifyBookingCancelledByClient({
    booking,
    business,
    language: body.language === "en" ? "en" : "pl",
  })

  return NextResponse.json({ ok: true, notice: result.notice })
}
