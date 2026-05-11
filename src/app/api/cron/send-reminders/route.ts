import { NextResponse, type NextRequest } from "next/server"

import {
  sendAppointmentReminderEmail,
  type AppointmentReminderEmailResult,
} from "@/lib/notifications/appointment-reminder-email"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BATCH_SIZE = 20
const MAX_ATTEMPTS = 3

/**
 * Etap 1: cron wysyłający przypomnienia e-mail z kolejki `appointment_reminders`.
 * Wymagane envy:
 *   - CRON_SECRET
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   - RESEND_API_KEY
 *   - REMINDERS_FROM_EMAIL (opcjonalnie; fallback RESEND_FROM, a finalnie default w helperze)
 *
 * Wywołanie:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/send-reminders
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = req.headers.get("authorization")?.trim()
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

type DueReminderRow = {
  id: string
  business_id: string
  appointment_id: string
  channel: string
  reminder_kind: string
  scheduled_for: string
  attempts: number
}

type BookingRow = {
  id: string
  business_id: string
  status: string
  client_email: string | null
  client_name: string | null
  service_name: string | null
  staff_name: string | null
  appointment_date: string
  appointment_time: string
}

type BusinessRow = {
  id: string
  business_name: string | null
  email: string | null
}

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[cron/send-reminders] service role not configured")
    return NextResponse.json(
      { ok: false, error: "service_unconfigured" },
      { status: 503 }
    )
  }

  const nowIso = new Date().toISOString()

  // 1. Wybieramy partię pending e-mailowych przypomnień gotowych do wysłania.
  const { data: dueRows, error: dueError } = await admin
    .from("appointment_reminders")
    .select("id, business_id, appointment_id, channel, reminder_kind, scheduled_for, attempts")
    .eq("channel", "email")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE)

  if (dueError) {
    console.error("[cron/send-reminders] fetch_due_failed", {
      message: dueError.message,
      code: dueError.code,
    })
    return NextResponse.json(
      { ok: false, error: "fetch_due_failed" },
      { status: 500 }
    )
  }

  const items = (dueRows ?? []) as DueReminderRow[]
  if (items.length === 0) {
    console.info("[cron/send-reminders] no_due_reminders")
    return NextResponse.json({ ok: true, found: 0, sent: 0, failed: 0, skipped: 0 })
  }

  // 2. Lockujemy paczkę – status processing + locked_at. Warunkujemy poprzedni
  //    status='pending', więc dwa równoczesne uruchomienia crona nie odbiorą
  //    tego samego rekordu drugi raz (race-safe na poziomie WHERE).
  const ids = items.map((r) => r.id)
  const { data: locked, error: lockError } = await admin
    .from("appointment_reminders")
    .update({ status: "processing", locked_at: nowIso })
    .in("id", ids)
    .eq("status", "pending")
    .select("id")

  if (lockError) {
    console.error("[cron/send-reminders] lock_failed", {
      message: lockError.message,
      code: lockError.code,
    })
    return NextResponse.json({ ok: false, error: "lock_failed" }, { status: 500 })
  }
  const lockedIds = new Set<string>((locked ?? []).map((r) => r.id))
  const lockedItems = items.filter((r) => lockedIds.has(r.id))

  console.info("[cron/send-reminders] batch_start", {
    found: items.length,
    locked: lockedItems.length,
  })

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const item of lockedItems) {
    const result = await processSingleReminder(admin, item)
    if (result === "sent") sent += 1
    else if (result === "failed") failed += 1
    else if (result === "skipped") skipped += 1
  }

  console.info("[cron/send-reminders] batch_done", {
    found: items.length,
    locked: lockedItems.length,
    sent,
    failed,
    skipped,
  })

  return NextResponse.json({
    ok: true,
    found: items.length,
    locked: lockedItems.length,
    sent,
    failed,
    skipped,
  })
}

type ProcessOutcome = "sent" | "failed" | "skipped"

async function processSingleReminder(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  item: DueReminderRow
): Promise<ProcessOutcome> {
  try {
    const { data: bookingRaw, error: bookingError } = await admin
      .from("bookings")
      .select(
        "id, business_id, status, client_email, client_name, service_name, staff_name, appointment_date, appointment_time"
      )
      .eq("id", item.appointment_id)
      .maybeSingle()

    if (bookingError) {
      return await recordFailure(admin, item, `booking_lookup_error: ${bookingError.message}`)
    }
    const booking = bookingRaw as BookingRow | null
    if (!booking) {
      await markSkipped(admin, item.id, "booking_not_found")
      return "skipped"
    }
    if (booking.status === "cancelled") {
      await markSkipped(admin, item.id, "booking_cancelled")
      return "skipped"
    }
    const recipient = (booking.client_email ?? "").trim()
    if (recipient.length === 0) {
      await markSkipped(admin, item.id, "no_email")
      return "skipped"
    }

    const { data: businessRaw } = await admin
      .from("business_profiles")
      .select("id, business_name, email")
      .eq("id", item.business_id)
      .maybeSingle()
    const business = (businessRaw ?? null) as BusinessRow | null
    const businessName =
      (business?.business_name && business.business_name.trim().length > 0
        ? business.business_name.trim()
        : null) ?? "WizytaOK"
    const replyTo =
      business?.email && business.email.trim().length > 0 ? business.email.trim() : null

    const emailResult: AppointmentReminderEmailResult = await sendAppointmentReminderEmail({
      to: recipient,
      businessName,
      appointmentDate: booking.appointment_date,
      appointmentTime: booking.appointment_time,
      serviceName: booking.service_name,
      staffName: booking.staff_name,
      clientName: booking.client_name,
      replyTo,
    })

    if (emailResult.ok) {
      const { error: updateError } = await admin
        .from("appointment_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider: emailResult.provider,
          provider_message_id: emailResult.messageId,
          locked_at: null,
          last_error: null,
          attempts: item.attempts + 1,
        })
        .eq("id", item.id)
      if (updateError) {
        console.error("[cron/send-reminders] update_sent_failed", {
          id: item.id,
          message: updateError.message,
        })
      }
      return "sent"
    }

    if (emailResult.code === "not_configured") {
      // Bez kluczy nie da się wysłać niczego — odkładamy do następnego runa
      // jako pending (bez zwiększania attempts), żeby po dodaniu env nie zrzucić wizyt do failed.
      await admin
        .from("appointment_reminders")
        .update({
          status: "pending",
          locked_at: null,
          last_error: emailResult.error,
        })
        .eq("id", item.id)
      return "failed"
    }

    return await recordFailure(admin, item, emailResult.error)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return await recordFailure(admin, item, msg)
  }
}

async function markSkipped(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  reminderId: string,
  reason: string
): Promise<void> {
  const { error } = await admin
    .from("appointment_reminders")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
      locked_at: null,
      last_error: reason,
    })
    .eq("id", reminderId)
  if (error) {
    console.error("[cron/send-reminders] mark_skipped_failed", {
      reminderId,
      message: error.message,
    })
  }
}

async function recordFailure(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  item: DueReminderRow,
  errorMessage: string | undefined
): Promise<"failed"> {
  const nextAttempts = item.attempts + 1
  const finalFail = nextAttempts >= MAX_ATTEMPTS
  const truncatedError = (errorMessage ?? "send_failed").slice(0, 500)
  const { error } = finalFail
    ? await admin
        .from("appointment_reminders")
        .update({
          status: "failed",
          attempts: nextAttempts,
          last_error: truncatedError,
          locked_at: null,
          failed_at: new Date().toISOString(),
        })
        .eq("id", item.id)
    : await admin
        .from("appointment_reminders")
        .update({
          status: "pending",
          attempts: nextAttempts,
          last_error: truncatedError,
          locked_at: null,
        })
        .eq("id", item.id)
  if (error) {
    console.error("[cron/send-reminders] mark_failure_failed", {
      reminderId: item.id,
      message: error.message,
    })
  }
  return "failed"
}
