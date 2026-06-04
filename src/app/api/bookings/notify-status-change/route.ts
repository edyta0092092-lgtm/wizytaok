import { NextResponse } from "next/server"

import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import { getBookingCreatedNotifyStatus } from "@/lib/notifications/booking-created-server"
import { notifyBookingConfirmedForBooking } from "@/lib/notifications/booking-confirmed-server"
import { notifyBookingCancelledByCompany } from "@/lib/notifications/booking-cancelled-by-company-server"
import { notifyNoShowFollowUp } from "@/lib/notifications/no-show-follow-up-server"
import { notifyThankYouAfterVisit } from "@/lib/notifications/thank-you-after-visit-server"
import {
  dispatchCustomTemplatesForEvent,
  type CustomTemplateEventKey,
} from "@/lib/notifications/custom-templates-dispatch"
import { getServerClient } from "@/lib/supabase/server"
import type { Tables } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type Body = {
  bookingId?: string
  status?: string
  language?: "pl" | "en"
}

const STATUS_TO_EVENT: Record<string, CustomTemplateEventKey> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
  no_show: "no_show",
  completed: "completed",
}

/**
 * Po zmianie statusu wizyty z panelu: standardowe powiadomienie (SMS/e-mail + log)
 * oraz własne szablony typu „zdarzenie".
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

  const { data: bookingRow, error: bookingErr } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingUuid)
    .maybeSingle()
  if (bookingErr || !bookingRow) {
    return NextResponse.json({ ok: false, error: "booking_not_found" }, { status: 404 })
  }
  const booking = bookingRow as Tables<"bookings">

  const { data: profile, error: profErr } = await supabase
    .from("business_profiles")
    .select("id, slug, phone, contact_phone, business_name, business_address")
    .eq("id", booking.business_id)
    .maybeSingle()
  if (profErr || !profile) {
    return NextResponse.json({ ok: true, notice: "skipped" as const, reason: "no_business" })
  }

  const language = body.language === "en" ? "en" : "pl"
  let standardNotice: string | null = null

  try {
    if (eventKey === "confirmed" && booking.status === "confirmed") {
      const createdStatus = await getBookingCreatedNotifyStatus(bookingUuid)
      if (
        createdStatus.email.status === "sent" ||
        createdStatus.sms.status === "sent" ||
        createdStatus.email.status === "already_sent" ||
        createdStatus.sms.status === "already_sent"
      ) {
        return NextResponse.json({
          ok: true,
          standardNotice: "skipped",
          reason: "booking_created_already_sent",
        })
      }
      const result = await notifyBookingConfirmedForBooking({
        booking,
        business: profile,
        language,
      })
      standardNotice = result.email === "sent" || result.sms === "sent" ? "sent" : "queued"
      return NextResponse.json({ ok: true, standardNotice })
    }
    if (eventKey === "cancelled") {
      const { notice } = await notifyBookingCancelledByCompany({
        booking: { ...booking, status: "cancelled" },
        business: profile,
        language,
      })
      standardNotice = notice
    }
    if (eventKey === "no_show") {
      const { notice } = await notifyNoShowFollowUp({
        booking: { ...booking, status: "no_show" },
        business: profile,
        language,
      })
      standardNotice = notice
    }
    if (eventKey === "completed") {
      const { notice } = await notifyThankYouAfterVisit({
        booking: { ...booking, status: "completed" },
        business: profile,
        language,
      })
      standardNotice = notice
    }
  } catch {
    standardNotice = "skipped"
  }

  try {
    const custom = await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey })
    return NextResponse.json({
      ok: true,
      standardNotice,
      customTemplates: custom,
    })
  } catch {
    return NextResponse.json({
      ok: true,
      standardNotice: standardNotice ?? "skipped",
      notice: "skipped" as const,
      reason: "dispatch_error",
    })
  }
}
