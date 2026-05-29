import { NextResponse } from "next/server"

import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import {
  notifyNoShowFollowUp,
  type NoShowFollowUpLanguage,
} from "@/lib/notifications/no-show-follow-up-server"
import { dispatchCustomTemplatesForEvent } from "@/lib/notifications/custom-templates-dispatch"
import { getServerClient } from "@/lib/supabase/server"
import type { Tables } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  bookingId?: string
  language?: NoShowFollowUpLanguage
}

/**
 * Wysyła follow-up po oznaczeniu wizyty jako „nieobecność klienta”.
 * Status wizyty jest już ustawiony po stronie klienta — tu tylko powiadomienie.
 */
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

  if (booking.status !== "no_show") {
    return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "not_no_show" })
  }

  const { data: profile, error: profErr } = await supabase
    .from("business_profiles")
    .select("id, slug, phone, contact_phone, business_name, business_address")
    .eq("id", booking.business_id)
    .maybeSingle()
  if (profErr || !profile) {
    return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "no_business" })
  }

  const language: NoShowFollowUpLanguage = body.language === "en" ? "en" : "pl"
  try {
    const { notice } = await notifyNoShowFollowUp({ booking, business: profile, language })
    try {
      await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey: "no_show" })
    } catch {
      // własne szablony nie blokują follow-upu
    }
    return NextResponse.json({ ok: true, notice })
  } catch {
    return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "send_error" })
  }
}
