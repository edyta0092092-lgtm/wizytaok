import { NextResponse } from "next/server"

import { resolveSupabaseBookingRowUuidFromUiId } from "@/lib/bookings/bookings-store"
import {
  notifyThankYouAfterVisit,
  THANK_YOU_AFTER_VISIT_LOG_TYPE,
} from "@/lib/notifications/thank-you-after-visit-server"
import { dispatchCustomTemplatesForEvent } from "@/lib/notifications/custom-templates-dispatch"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables, TablesUpdate } from "@/types/database"

type Body = {
  bookingId?: string
  language?: "pl" | "en"
  /** Domyślnie `true` — SMS/e-mail z podziękowaniem. */
  notifyClient?: boolean
}

async function hasThankYouNotificationLog(bookingId: string): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false
  const { count } = await admin
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .eq("type", THANK_YOU_AFTER_VISIT_LOG_TYPE)
    .eq("status", "sent")
  return (count ?? 0) > 0
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
  const alreadyCompleted = booking.status === "completed"

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, slug, phone, contact_phone, business_name, business_address")
    .eq("id", booking.business_id)
    .maybeSingle()

  const language = body.language === "en" ? "en" : "pl"
  const shouldNotifyClient = body.notifyClient !== false

  let notice: "saved" | "queued" | "sent" | "skipped" = "saved"
  let notificationSkipped = false

  if (shouldNotifyClient && profile) {
    if (alreadyCompleted && (await hasThankYouNotificationLog(bookingUuid))) {
      try {
        await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey: "completed" })
      } catch {
        // własne szablony nie blokują odpowiedzi
      }
      notice = "queued"
    } else {
      try {
        const notifyResult = await notifyThankYouAfterVisit({
          booking: { ...booking, status: "completed" },
          business: profile,
          language,
        })
        notice = notifyResult.notice
        try {
          await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey: "completed" })
        } catch {
          // własne szablony nie blokują głównej odpowiedzi
        }
      } catch (err) {
        console.error("[complete-by-company] thank_you_notify_failed", {
          bookingId: bookingUuid,
          error: err instanceof Error ? err.message : String(err),
        })
        notificationSkipped = true
      }
    }
  } else if (shouldNotifyClient) {
    notificationSkipped = true
  }

  if (!alreadyCompleted) {
    const now = new Date().toISOString()
    const patch: TablesUpdate<"bookings"> = {
      status: "completed",
      last_updated_by: "business",
      last_status_change_source: "manual",
      updated_at: now,
    }
    const { error: upErr } = await supabase.from("bookings").update(patch).eq("id", bookingUuid)
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 })
    }
  }

  return NextResponse.json({
    ok: true,
    notice,
    ...(notificationSkipped ? { notificationSkipped: true as const } : {}),
    ...(alreadyCompleted ? { alreadyCompleted: true as const } : {}),
  })
}
