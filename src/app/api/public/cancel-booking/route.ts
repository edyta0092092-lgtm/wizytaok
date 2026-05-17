import { NextResponse } from "next/server"

import { cancelPublicBookingById } from "@/lib/bookings/cancel-public-booking-server"
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

  const { data: bookingRaw } = await admin.rpc("get_booking_by_confirmation_token", { p_token: token })
  if (!bookingRaw || typeof bookingRaw !== "object") {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }
  const raw = bookingRaw as Record<string, unknown>
  const bookingId = String(raw.id ?? "").trim()
  const businessId = String(raw.business_id ?? "").trim()
  if (!bookingId || !businessId) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  const cancelRes = await cancelPublicBookingById(admin, bookingId)
  if (!cancelRes.ok) {
    return NextResponse.json({ ok: false, error: cancelRes.error }, { status: 500 })
  }

  const { data: business } = await admin
    .from("business_profiles")
    .select("slug,phone,business_name")
    .eq("id", businessId)
    .maybeSingle()

  if (!business) return NextResponse.json({ ok: true, notice: "queued" })

  const { data: booking } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle()
  if (!booking) return NextResponse.json({ ok: true, notice: "queued" })

  const result = await notifyBookingCancelledByClient({
    booking,
    business,
    language: body.language === "en" ? "en" : "pl",
  })

  return NextResponse.json({ ok: true, notice: result.notice })
}
