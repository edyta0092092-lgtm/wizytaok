import { NextResponse } from "next/server"

import { requireGoogleCalendarMember } from "@/lib/integrations/google-calendar/member-auth"
import { syncBookingToGoogleCalendar } from "@/lib/integrations/google-calendar/sync-booking-server"
import type { GoogleCalendarSyncAction } from "@/lib/integrations/google-calendar/types"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  bookingId?: string
  action?: GoogleCalendarSyncAction
}

export async function POST(req: Request) {
  const auth = await requireGoogleCalendarMember()
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
  const action = body.action === "cancel" ? "cancel" : "upsert"
  if (!bookingId) {
    return NextResponse.json({ ok: false, error: "booking_id_required" }, { status: 400 })
  }

  const admin = getServiceRoleClient()
  if (admin) {
    const { data: booking } = await admin
      .from("bookings")
      .select("business_id")
      .eq("id", bookingId)
      .maybeSingle()
    if (!booking || booking.business_id !== auth.ctx.businessId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
    }
  }

  const result = await syncBookingToGoogleCalendar(bookingId, action)
  return NextResponse.json({ ok: result.ok, result })
}
