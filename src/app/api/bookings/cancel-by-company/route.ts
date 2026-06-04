import { NextResponse } from "next/server"

import {
  buildBookingCancelledNotifyContent,
  hasCancellationHistoryLog,
  ensureCancellationLogsInHistory,
  inferMessagesEffectivelySent,
  notifyBookingCancelledByCompany,
  type CancelNotifyLanguage,
} from "@/lib/notifications/booking-cancelled-by-company-server"
import {
  resolveSupabaseBookingRowUuidFromUiId,
  SB_BOOKING_PREFIX,
} from "@/lib/bookings/bookings-store"
import type { TransactionalHistoryMirror } from "@/lib/notifications/transactional-history-mirror"
import { dispatchCustomTemplatesForEvent } from "@/lib/notifications/custom-templates-dispatch"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables, TablesUpdate } from "@/types/database"

type DbClient = SupabaseClient<Database>

async function hasCancellationNotificationLog(bookingId: string): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false
  const { count } = await admin
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", bookingId)
    .in("type", ["booking_cancelled_by_company", "booking_cancelled_by_client"])
    .in("status", ["sent", "queued"])
  return (count ?? 0) > 0
}

async function applyBookingPatchSafely(
  client: DbClient,
  bookingUuid: string,
  base: TablesUpdate<"bookings">,
): Promise<string | null> {
  let current: TablesUpdate<"bookings"> = { ...base }
  for (let i = 0; i < 6; i += 1) {
    const { error } = await client.from("bookings").update(current).eq("id", bookingUuid)
    if (!error) return null
    const msg = String(error.message ?? "")
    const m = msg.match(/column\s+([a-zA-Z0-9_\."]+)\s+does not exist/i)
    if (!m) return msg
    const raw = m[1] ?? ""
    const missing = raw.replace(/"/g, "").split(".").pop()?.trim() ?? ""
    if (!missing) return msg
    const next = { ...current } as Record<string, unknown>
    if (!(missing in next)) return msg
    delete next[missing]
    current = next as TablesUpdate<"bookings">
  }
  return "update_failed"
}

async function persistCancelledBookingStatus(
  memberClient: DbClient,
  bookingUuid: string,
  patch: TablesUpdate<"bookings">,
): Promise<string | null> {
  const admin = getServiceRoleClient()
  const clients: DbClient[] = admin ? [memberClient, admin] : [memberClient]

  for (const client of clients) {
    const err = await applyBookingPatchSafely(client, bookingUuid, patch)
    if (!err) return null
  }

  for (const client of clients) {
    const err = await applyBookingPatchSafely(client, bookingUuid, { status: "cancelled" })
    if (!err) return null
  }

  return "update_failed"
}

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
  const alreadyCancelled = booking.status === "cancelled"

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

  if (!alreadyCancelled) {
    const upErrMsg = await persistCancelledBookingStatus(supabase, bookingUuid, patch)
    if (upErrMsg) {
      return NextResponse.json({ ok: false, error: upErrMsg }, { status: 400 })
    }
  }

  const shouldNotifyClient = body.notifyClient !== false

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, slug, phone, contact_phone, business_name, business_address")
    .eq("id", booking.business_id)
    .maybeSingle()

  const language: CancelNotifyLanguage = body.language === "en" ? "en" : "pl"
  const updatedBooking: Tables<"bookings"> = {
    ...booking,
    ...patch,
    cancelled_at: booking.cancelled_at ?? now,
    cancellation_note: note ?? booking.cancellation_note,
    status: "cancelled",
  }

  let notice: "saved" | "queued" | "sent" = "saved"
  let notificationSkipped = false
  let cancellationHistoryMirror: TransactionalHistoryMirror | undefined

  const admin = getServiceRoleClient()

  if (shouldNotifyClient && profile) {
    if (alreadyCancelled && (await hasCancellationNotificationLog(bookingUuid))) {
      try {
        await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey: "cancelled" })
      } catch {
        // własne szablony nie blokują odpowiedzi
      }
      notice = "queued"
    } else {
      try {
        const messagesOn = inferMessagesEffectivelySent()
        const notifyArgs = {
          booking: updatedBooking,
          business: profile,
          language,
          messagesEffectivelySent: messagesOn,
        }
        const notifyResult = await notifyBookingCancelledByCompany(notifyArgs)
        notice = notifyResult.notice
        if (
          admin &&
          (notifyResult.notice === "sent" || notifyResult.notice === "queued") &&
          !(await hasCancellationHistoryLog(admin, bookingUuid))
        ) {
          await ensureCancellationLogsInHistory(notifyArgs)
        }
        if (
          admin &&
          (notifyResult.notice === "sent" || notifyResult.notice === "queued") &&
          profile.slug?.trim()
        ) {
          const content = await buildBookingCancelledNotifyContent(
            admin,
            updatedBooking,
            profile,
            language,
          )
          cancellationHistoryMirror = {
            bookingUiId: `${SB_BOOKING_PREFIX}${bookingUuid}`,
            businessSlug: profile.slug.trim(),
            clientName: booking.client_name?.trim() || "",
            clientPhone: booking.client_phone,
            clientEmail: booking.client_email,
            confirmationToken: booking.confirmation_token,
            serviceName: booking.service_name?.trim() || null,
            appointmentDate: String(booking.appointment_date ?? "").slice(0, 10) || null,
            appointmentTime: String(booking.appointment_time ?? "").slice(0, 5) || null,
            appointmentStatus: "cancelled",
            smsBody: content.sendSms ? content.sms : null,
            emailSubject: content.sendEmail ? content.emailSubject : null,
            emailBody: content.sendEmail ? content.emailText : null,
          }
        }
        try {
          await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey: "cancelled" })
        } catch {
          // własne szablony nie blokują głównej odpowiedzi
        }
      } catch {
        notificationSkipped = true
      }
    }
  } else if (shouldNotifyClient) {
    notificationSkipped = true
  }

  if (!shouldNotifyClient) {
    return NextResponse.json({
      ok: true,
      notice: "saved" as const,
      notificationSkipped: true,
      ...(alreadyCancelled ? { alreadyCancelled: true as const } : {}),
    })
  }

  return NextResponse.json({
    ok: true,
    notice,
    ...(cancellationHistoryMirror ? { cancellationHistoryMirror } : {}),
    ...(notificationSkipped ? { notificationSkipped: true as const } : {}),
    ...(alreadyCancelled ? { alreadyCancelled: true as const } : {}),
  })
}
