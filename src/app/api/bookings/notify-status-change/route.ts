import { NextResponse } from "next/server"

import {
  resolveSupabaseBookingRowUuidFromUiId,
  SB_BOOKING_PREFIX,
} from "@/lib/bookings/bookings-store"
import { getBookingCreatedNotifyStatus } from "@/lib/notifications/booking-created-server"
import { notifyBookingConfirmedForBooking } from "@/lib/notifications/booking-confirmed-server"
import {
  buildBookingCancelledNotifyContent,
  ensureCancellationLogsInHistory,
  hasCancellationHistoryLog,
  notifyBookingCancelledByCompany,
} from "@/lib/notifications/booking-cancelled-by-company-server"
import {
  buildNoShowFollowUpContent,
  ensureNoShowFollowUpLogsInHistory,
  hasNoShowFollowUpHistoryLog,
  notifyNoShowFollowUp,
} from "@/lib/notifications/no-show-follow-up-server"
import { notifyThankYouAfterVisit } from "@/lib/notifications/thank-you-after-visit-server"
import type { TransactionalHistoryMirror } from "@/lib/notifications/transactional-history-mirror"
import {
  dispatchCustomTemplatesForEvent,
  type CustomTemplateEventKey,
} from "@/lib/notifications/custom-templates-dispatch"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
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

function buildTransactionalHistoryMirror(args: {
  bookingUuid: string
  booking: Tables<"bookings">
  businessSlug: string
  appointmentStatus: string
  smsBody: string | null
  emailSubject: string | null
  emailBody: string | null
}): TransactionalHistoryMirror {
  return {
    bookingUiId: `${SB_BOOKING_PREFIX}${args.bookingUuid}`,
    businessSlug: args.businessSlug,
    clientName: args.booking.client_name?.trim() || "",
    clientPhone: args.booking.client_phone,
    clientEmail: args.booking.client_email,
    confirmationToken: args.booking.confirmation_token,
    serviceName: args.booking.service_name?.trim() || null,
    appointmentDate: String(args.booking.appointment_date ?? "").slice(0, 10) || null,
    appointmentTime: String(args.booking.appointment_time ?? "").slice(0, 5) || null,
    appointmentStatus: args.appointmentStatus,
    smsBody: args.smsBody,
    emailSubject: args.emailSubject,
    emailBody: args.emailBody,
  }
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

  const language: "pl" | "en" = body.language === "en" ? "en" : "pl"
  const admin = getServiceRoleClient()
  let standardNotice: string | null = null
  let transactionalHistoryMirror: TransactionalHistoryMirror | undefined

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
      const notifyArgs = {
        booking: { ...booking, status: "cancelled" },
        business: profile,
        language,
      }
      const { notice } = await notifyBookingCancelledByCompany(notifyArgs)
      standardNotice = notice
      if (
        admin &&
        (notice === "sent" || notice === "queued") &&
        !(await hasCancellationHistoryLog(admin, bookingUuid))
      ) {
        await ensureCancellationLogsInHistory(notifyArgs)
      }
      if (admin && (notice === "sent" || notice === "queued") && profile.slug?.trim()) {
        const content = await buildBookingCancelledNotifyContent(
          admin,
          notifyArgs.booking,
          profile,
          language,
        )
        transactionalHistoryMirror = buildTransactionalHistoryMirror({
          bookingUuid,
          booking: notifyArgs.booking,
          businessSlug: profile.slug.trim(),
          appointmentStatus: "cancelled",
          smsBody: content.sendSms ? content.sms : null,
          emailSubject: content.sendEmail ? content.emailSubject : null,
          emailBody: content.sendEmail ? content.emailText : null,
        })
      }
    }
    if (eventKey === "no_show") {
      const notifyArgs = {
        booking: { ...booking, status: "no_show" },
        business: profile,
        language,
      }
      const { notice } = await notifyNoShowFollowUp(notifyArgs)
      standardNotice = notice
      if (
        admin &&
        (notice === "sent" || notice === "queued") &&
        !(await hasNoShowFollowUpHistoryLog(admin, bookingUuid))
      ) {
        await ensureNoShowFollowUpLogsInHistory(notifyArgs)
      }
      if (admin && (notice === "sent" || notice === "queued") && profile.slug?.trim()) {
        const content = await buildNoShowFollowUpContent(
          admin,
          notifyArgs.booking,
          profile,
          language,
        )
        transactionalHistoryMirror = buildTransactionalHistoryMirror({
          bookingUuid,
          booking: notifyArgs.booking,
          businessSlug: profile.slug.trim(),
          appointmentStatus: "no_show",
          smsBody: content.sendSms ? content.smsText : null,
          emailSubject: content.sendEmail ? content.emailSubject : null,
          emailBody: content.sendEmail ? content.emailText : null,
        })
      }
    }
    if (eventKey === "completed") {
      const { notice } = await notifyThankYouAfterVisit({
        booking: { ...booking, status: "completed" },
        business: profile,
        language,
      })
      standardNotice = notice
    }
  } catch (err) {
    console.error("[notify-status-change] standard_notify_failed", {
      eventKey,
      bookingId: bookingUuid,
      error: err instanceof Error ? err.message : String(err),
    })
    standardNotice = "skipped"
  }

  try {
    const custom = await dispatchCustomTemplatesForEvent({ bookingId: bookingUuid, eventKey })
    return NextResponse.json({
      ok: true,
      standardNotice,
      ...(transactionalHistoryMirror ? { transactionalHistoryMirror } : {}),
      customTemplates: custom,
    })
  } catch {
    return NextResponse.json({
      ok: true,
      standardNotice: standardNotice ?? "skipped",
      ...(transactionalHistoryMirror ? { transactionalHistoryMirror } : {}),
      notice: "skipped" as const,
      reason: "dispatch_error",
    })
  }
}
