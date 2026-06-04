import { NextResponse } from "next/server"

import {
  resolveSupabaseBookingRowUuidFromUiId,
  SB_BOOKING_PREFIX,
} from "@/lib/bookings/bookings-store"
import {
  buildThankYouAfterVisitContent,
  ensureThankYouLogsInHistory,
  hasThankYouAfterVisitHistoryLog,
  notifyThankYouAfterVisit,
  type ThankYouAfterVisitLanguage,
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

  const language: ThankYouAfterVisitLanguage = body.language === "en" ? "en" : "pl"
  const shouldNotifyClient = body.notifyClient !== false

  let notice: "saved" | "queued" | "sent" | "skipped" = "saved"
  let notificationSkipped = false
  let thankYouHistoryMirror:
    | {
        bookingUiId: string
        businessSlug: string
        clientName: string
        clientPhone: string | null
        clientEmail: string | null
        confirmationToken: string
        smsBody: string | null
        emailSubject: string | null
        emailBody: string | null
      }
    | undefined

  const admin = getServiceRoleClient()

  if (shouldNotifyClient && profile) {
    if (admin && alreadyCompleted && (await hasThankYouAfterVisitHistoryLog(admin, bookingUuid))) {
      try {
        await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey: "completed" })
      } catch {
        // własne szablony nie blokują odpowiedzi
      }
      notice = "queued"
    } else {
      try {
        const notifyArgs = {
          booking: { ...booking, status: "completed" as const },
          business: profile,
          language,
        }
        const notifyResult = await notifyThankYouAfterVisit(notifyArgs)
        notice = notifyResult.notice
        if (
          admin &&
          (notifyResult.notice === "sent" || notifyResult.notice === "queued") &&
          !(await hasThankYouAfterVisitHistoryLog(admin, bookingUuid))
        ) {
          await ensureThankYouLogsInHistory(notifyArgs)
        }
        if (
          admin &&
          (notifyResult.notice === "sent" || notifyResult.notice === "queued") &&
          profile.slug?.trim()
        ) {
          const content = await buildThankYouAfterVisitContent(admin, notifyArgs.booking, profile, language)
          thankYouHistoryMirror = {
            bookingUiId: `${SB_BOOKING_PREFIX}${bookingUuid}`,
            businessSlug: profile.slug.trim(),
            clientName: booking.client_name?.trim() || "",
            clientPhone: booking.client_phone,
            clientEmail: booking.client_email,
            confirmationToken: booking.confirmation_token,
            smsBody: content.sendSms ? content.smsText : null,
            emailSubject: content.sendEmail ? content.emailSubject : null,
            emailBody: content.sendEmail ? content.emailText : null,
          }
        }
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
    ...(thankYouHistoryMirror ? { thankYouHistoryMirror } : {}),
    ...(notificationSkipped ? { notificationSkipped: true as const } : {}),
    ...(alreadyCompleted ? { alreadyCompleted: true as const } : {}),
  })
}
