import { NextResponse } from "next/server"

import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { mapPreviewBookingRow } from "@/lib/messages/preview-booking-info"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const rawId = url.searchParams.get("bookingId")?.trim() ?? ""
  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(rawId)
  if (!bookingUuid) {
    return NextResponse.json({ ok: false, error: "invalid_booking_id" }, { status: 400 })
  }

  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  const selects = [
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,updated_at,last_status_change_source,confirmation_token,staff_name",
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,confirmation_token,staff_name",
  ]

  for (const select of selects) {
    const { data, error } = await admin
      .from("bookings")
      .select(select)
      .eq("id", bookingUuid)
      .eq("business_id", resolution.businessId)
      .maybeSingle()

    if (!error && data) {
      return NextResponse.json({
        ok: true,
        booking: mapPreviewBookingRow(data as unknown as Record<string, unknown>, bookingUuid),
      })
    }
    const msg = String(error?.message ?? "")
    if (!/column .* does not exist/i.test(msg) && !/schema cache/i.test(msg)) {
      return NextResponse.json({ ok: false, error: msg || "booking_not_found" }, { status: 404 })
    }
  }

  return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
}
