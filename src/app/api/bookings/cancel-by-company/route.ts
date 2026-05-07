import { NextResponse } from "next/server"

import {
  inferMessagesEffectivelySent,
  notifyBookingCancelledByCompany,
  type CancelNotifyLanguage,
} from "@/lib/notifications/booking-cancelled-by-company-server"
import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import { getServerClient } from "@/lib/supabase/server"
import type { Tables, TablesUpdate } from "@/types/database"

type Body = {
  bookingId?: string
  cancellationNote?: string | null
  language?: CancelNotifyLanguage
  /** Domyślnie `true` (SMS/e-mail). `false` = tylko zapis w bazie (np. akcja „Usuń” na liście). */
  notifyClient?: boolean
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
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

  const { data: bookingRow, error: bookingErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingUuid)
    .maybeSingle()

  if (bookingErr || !bookingRow) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }

  const booking = bookingRow as Tables<"bookings">

  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: true, notice: "queued" as const, alreadyCancelled: true })
  }

  const now = new Date().toISOString()
  const note =
    body.cancellationNote != null && String(body.cancellationNote).trim()
      ? String(body.cancellationNote).trim()
      : null

  const patch: TablesUpdate<"bookings"> = {
    status: "cancelled",
    cancelled_at: now,
    cancelled_by: "company",
    cancellation_note: note,
    last_updated_by: "business",
    last_status_change_source: "manual",
    updated_at: now,
  }

  const { error: upErr } = await supabase.from("bookings").update(patch).eq("id", bookingUuid)
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
  }

  const shouldNotifyClient = body.notifyClient !== false
  if (!shouldNotifyClient) {
    return NextResponse.json({ ok: true, notice: "saved" as const, notificationSkipped: true })
  }

  const { data: profile, error: profErr } = await supabase
    .from("business_profiles")
    .select("id, slug, phone, business_name")
    .eq("id", booking.business_id)
    .maybeSingle()

  if (profErr || !profile) {
    return NextResponse.json({ ok: false, error: "business_not_found" }, { status: 400 })
  }

  const language: CancelNotifyLanguage = body.language === "en" ? "en" : "pl"
  const updatedBooking: Tables<"bookings"> = {
    ...booking,
    ...patch,
    cancelled_at: now,
    cancellation_note: note,
    status: "cancelled",
  }

  const messagesOn = inferMessagesEffectivelySent()
  const { notice } = await notifyBookingCancelledByCompany({
    booking: updatedBooking,
    business: profile,
    language,
    messagesEffectivelySent: messagesOn,
  })

  return NextResponse.json({ ok: true, notice })
}
