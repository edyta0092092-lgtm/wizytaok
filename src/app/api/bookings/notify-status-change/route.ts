import { NextResponse } from "next/server"

import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import {
  dispatchCustomTemplatesForEvent,
  type CustomTemplateEventKey,
} from "@/lib/notifications/custom-templates-dispatch"
import { getServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  bookingId?: string
  status?: string
}

const STATUS_TO_EVENT: Record<string, CustomTemplateEventKey> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
  no_show: "no_show",
  completed: "completed",
}

/**
 * Wyzwala własne szablony typu „zdarzenie" po zmianie statusu wizyty z panelu.
 * Status jest już ustawiony po stronie klienta — tu tylko ewentualne powiadomienia.
 */
export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const eventKey = STATUS_TO_EVENT[String(body.status ?? "").trim()]
  if (!eventKey) {
    return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "unsupported_status" })
  }

  const rawId = typeof body.bookingId === "string" ? body.bookingId.trim() : ""
  const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(rawId)
  if (!bookingUuid) {
    return NextResponse.json({ ok: false, error: "invalid_booking_id" }, { status: 400 })
  }

  const supabase = await getServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey })
    return NextResponse.json({ ok: true, ...result })
  } catch {
    return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "dispatch_error" })
  }
}
