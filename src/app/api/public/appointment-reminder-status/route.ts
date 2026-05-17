import { NextResponse } from "next/server"

import { appointmentHasPendingOrProcessingReminders } from "@/lib/appointments/public-pending-appointment-reminders"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token")?.trim() ?? ""
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  const { data: bookingRaw, error: bookingError } = await admin.rpc(
    "get_booking_by_confirmation_token",
    { p_token: token },
  )
  if (bookingError || !bookingRaw || typeof bookingRaw !== "object") {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  const bookingId = String((bookingRaw as Record<string, unknown>).id ?? "").trim()
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  const hasPendingReminder = await appointmentHasPendingOrProcessingReminders(admin, bookingId)
  if (hasPendingReminder === null) {
    return NextResponse.json({ ok: false, error: "reminder_status_unavailable" }, { status: 500 })
  }

  return NextResponse.json({ ok: true, hasPendingReminder })
}
