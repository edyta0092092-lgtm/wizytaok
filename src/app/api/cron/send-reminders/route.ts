import { NextResponse, type NextRequest } from "next/server"

import {
  sendAppointmentReminderEmail,
  type AppointmentReminderEmailResult,
} from "@/lib/notifications/appointment-reminder-email"
import {
  sendAppointmentReminderSms,
  sendAppointmentReminderSmsPlainText,
  type AppointmentReminderSmsResult,
} from "@/lib/notifications/appointment-reminder-sms"
import { formatPolishAppointmentLabel, isFirstReminderWindowPassed } from "@/lib/notifications/appointment-reminder-email"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { sendReminderEmail } from "@/lib/notifications/email"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import {
  applyTemplateVariables,
  getTemplateRuntime,
  type NotificationTemplateRuntime,
} from "@/lib/notifications/template-runtime"
import { getSmsQuotaStatus } from "@/lib/notifications/sms-monthly-limit"
import {
  DEFAULT_FIRST_REMINDER_MINUTES,
  DEFAULT_SECOND_REMINDER_MINUTES,
} from "@/lib/messages/reminder-settings-from-templates"
import { upsertReminderNotificationLog } from "@/lib/notifications/reminder-notification-log"
import { getStaffDisplayName, getStaffFirstName } from "@/lib/staff/staff-display"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EMAIL_BATCH_SIZE = 15
const SMS_BATCH_SIZE = 15
const MAX_ATTEMPTS = 3
/** Rekordy `processing` starsze niż ten próg wracają do `pending` (np. timeout crona). */
const STALE_PROCESSING_MS = 10 * 60 * 1000

/**
 * Cron wysyłający przypomnienia (e-mail oraz SMS) z kolejki `appointment_reminders`.
 *
 * Wymagane envy (e‑mail, etap 1):
 *   - CRON_SECRET
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   - RESEND_API_KEY
 *   - REMINDERS_FROM_EMAIL (opcjonalnie; fallback RESEND_FROM, a finalnie default w helperze)
 *
 * Dodatkowe envy (SMS):
 *   - SMSAPI_TOKEN / SZYBKISMS_TOKEN — gdy skonfigurowany, cron bierze SMS z kolejki
 *     (tak jak potwierdzenia wizyty). `SMS_REMINDERS_ENABLED=false` nie blokuje SMS,
 *     jeśli token jest ustawiony.
 *   - SMS_PROVIDER                 — `smsapi` (domyślnie) albo `szybkisms`.
 *   - SMSAPI_TOKEN, SMSAPI_FROM    — gdy dostawca SMSAPI.
 *   - SZYBKISMS_TOKEN, SZYBKISMS_FROM — gdy dostawca SzybkiSMS; opcjonalnie
 *     SZYBKISMS_API_BASE_URL (domyślnie https://api.szybkisms.pl/rest).
 *   - SMS_MONTHLY_INCLUDED_LIMIT   — limit faktycznie wysłanych SMS-ów (status='sent')
 *     per firma per kalendarzowy miesiąc (Europe/Warsaw). Fallback: 100.
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

type ReminderChannel = "email" | "sms"

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
  client_phone: string | null
  client_name: string | null
  service_name: string | null
  staff_name: string | null
  appointment_date: string
  appointment_time: string
  confirmation_token: string | null
}

type BusinessRow = {
  id: string
  business_name: string | null
  business_address: string | null
  email: string | null
  phone: string | null
  contact_phone: string | null
  slug: string | null
}

/**
 * Bazowy origin aplikacji do budowy absolutnych linków w mailach reminderowych.
 *
 * UWAGA: NIE używamy `VERCEL_URL`, bo na produkcji jest to techniczny
 * deployment URL (np. `wizytaok-92nw2diq7-...vercel.app`), który Vercel
 * chroni stroną logowania — klient po kliknięciu w link w mailu trafiłby na
 * `vercel.com/login`. Linki w mailach i SMS-ach muszą prowadzić tylko na
 * stabilną, publiczną domenę (`APP_ORIGIN` / `NEXT_PUBLIC_APP_URL`, a w
 * ostateczności twardy fallback produkcyjny).
 *
 * Kolejność rozstrzygania:
 *   1. APP_ORIGIN              (preferowane, ustawiane w Vercel)
 *   2. NEXT_PUBLIC_APP_URL     (fallback, też z env)
 *   3. NODE_ENV === "production" → https://wizytaok.vercel.app (twardy fallback)
 *   4. dev/test               → http://localhost:3000
 */
function getPublicAppOrigin(): string {
  const explicit =
    process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  if (process.env.NODE_ENV === "production") {
    return "https://wizytaok.vercel.app"
  }
  return "http://localhost:3000"
}

function hasSmsProviderToken(): boolean {
  return Boolean(process.env.SMSAPI_TOKEN?.trim() || process.env.SZYBKISMS_TOKEN?.trim())
}

/**
 * SMS z kolejki włączone, gdy jest token dostawcy (potwierdzenia już działają).
 * `SMS_REMINDERS_ENABLED=false` nie wyłącza SMS przy skonfigurowanym tokenie.
 */
function areSmsRemindersEnabled(): boolean {
  if (hasSmsProviderToken()) return true
  return process.env.SMS_REMINDERS_ENABLED?.trim().toLowerCase() === "true"
}

async function recoverStaleProcessingReminders(admin: AdminClient, nowIso: string): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()
  const { data, error } = await admin
    .from("appointment_reminders")
    .update({ status: "pending", locked_at: null })
    .eq("status", "processing")
    .lt("locked_at", staleBefore)
    .select("id")
  if (error) {
    console.error("[cron/send-reminders] recover_stale_failed", { message: error.message })
    return 0
  }
  const count = data?.length ?? 0
  if (count > 0) {
    console.info("[cron/send-reminders] recover_stale_processing", { count, nowIso })
  }
  return count
}

async function fetchDueChannelBatch(
  admin: AdminClient,
  channel: ReminderChannel,
  limit: number,
  nowIso: string,
): Promise<DueReminderRow[]> {
  let query = admin
    .from("appointment_reminders")
    .select("id, business_id, appointment_id, channel, reminder_kind, scheduled_for, attempts")
    .eq("status", "pending")
    .eq("channel", channel)
    .lte("scheduled_for", nowIso)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  const { data, error } = await query
  if (error) {
    throw new Error(`fetch_due_${channel}_failed: ${error.message}`)
  }
  return (data ?? []) as DueReminderRow[]
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
  const smsRemindersEnabled = areSmsRemindersEnabled()

  await recoverStaleProcessingReminders(admin, nowIso)

  // 1. Osobne paczki e-mail / SMS — e-maile nie wypierają SMS-ów z limitu batcha.
  let emailDue: DueReminderRow[] = []
  let smsDue: DueReminderRow[] = []
  try {
    ;[emailDue, smsDue] = await Promise.all([
      fetchDueChannelBatch(admin, "email", EMAIL_BATCH_SIZE, nowIso),
      smsRemindersEnabled
        ? fetchDueChannelBatch(admin, "sms", SMS_BATCH_SIZE, nowIso)
        : Promise.resolve([]),
    ])
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch_due_failed"
    console.error("[cron/send-reminders] fetch_due_failed", { message })
    return NextResponse.json({ ok: false, error: "fetch_due_failed" }, { status: 500 })
  }

  const items = [...smsDue, ...emailDue]
  if (items.length === 0) {
    console.info("[cron/send-reminders] no_due_reminders")
    return NextResponse.json({
      ok: true,
      found: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      sent_email: 0,
      sent_sms: 0,
    })
  }

  // 2. Lockujemy paczkę — status processing + locked_at. Warunkujemy poprzedni
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

  const counts = {
    found: items.length,
    locked: lockedItems.length,
    email: lockedItems.filter((r) => r.channel === "email").length,
    sms: lockedItems.filter((r) => r.channel === "sms").length,
  }
  console.info("[cron/send-reminders] batch_start", {
    ...counts,
    sms_reminders_enabled: smsRemindersEnabled,
    sms_provider_token: hasSmsProviderToken(),
  })

  let sent = 0
  let failed = 0
  let skipped = 0
  let sentEmail = 0
  let sentSms = 0

  // 3. Per-item dispatch. Każde wywołanie ma własny try/catch w wewnętrznym
  //    helperze — błąd jednego SMS-a NIE zatrzymuje paczki ani nie psuje
  //    pozostałych e-maili.
  for (const item of lockedItems) {
    const channel: ReminderChannel = item.channel === "sms" ? "sms" : "email"
    const result =
      channel === "sms"
        ? await processSmsReminder(admin, item)
        : await processEmailReminder(admin, item)

    if (result === "sent") {
      sent += 1
      if (channel === "sms") sentSms += 1
      else sentEmail += 1
    } else if (result === "failed") {
      failed += 1
    } else if (result === "skipped") {
      skipped += 1
    }
  }

  console.info("[cron/send-reminders] batch_done", {
    ...counts,
    sent,
    failed,
    skipped,
    sent_email: sentEmail,
    sent_sms: sentSms,
  })

  return NextResponse.json({
    ok: true,
    ...counts,
    sent,
    failed,
    skipped,
    sent_email: sentEmail,
    sent_sms: sentSms,
  })
}

type ProcessOutcome = "sent" | "failed" | "skipped"

type AdminClient = NonNullable<ReturnType<typeof getServiceRoleClient>>

const TERMINAL_BOOKING_STATUSES = new Set(["cancelled", "completed", "no_show"])

function isTerminalBookingStatus(status: string | null | undefined): boolean {
  return TERMINAL_BOOKING_STATUSES.has((status ?? "").trim())
}

async function loadBookingAndBusiness(
  admin: AdminClient,
  item: DueReminderRow
): Promise<
  | { ok: true; booking: BookingRow; business: BusinessRow | null }
  | { ok: false; reason: "lookup_error" | "not_found" | "booking_cancelled"; error?: string }
> {
  const { data: bookingRaw, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, business_id, status, client_email, client_phone, client_name, service_name, staff_name, appointment_date, appointment_time, confirmation_token"
    )
    .eq("id", item.appointment_id)
    .maybeSingle()

  if (bookingError) {
    return { ok: false, reason: "lookup_error", error: bookingError.message }
  }
  const booking = bookingRaw as BookingRow | null
  if (!booking) return { ok: false, reason: "not_found" }
  if (isTerminalBookingStatus(booking.status)) {
    return { ok: false, reason: "booking_cancelled" }
  }

  const { data: businessRaw } = await admin
    .from("business_profiles")
    .select("id, business_name, business_address, email, phone, contact_phone, slug")
    .eq("id", item.business_id)
    .maybeSingle()
  const business = (businessRaw ?? null) as BusinessRow | null

  return { ok: true, booking, business }
}

function resolveManageUrl(booking: BookingRow): string | null {
  const token = (booking.confirmation_token ?? "").trim()
  if (token.length === 0) return null
  return `${getPublicAppOrigin()}/confirm/${encodeURIComponent(token)}?source=reminder`
}

function resolveBusinessName(business: BusinessRow | null): string {
  const name = business?.business_name?.trim()
  return name && name.length > 0 ? name : "WizytaOK"
}

function defaultTimingMinutesForReminderKind(reminderKind: string): number {
  const k = reminderKind.trim().toLowerCase()
  if (k === "second" || k === "appointment_reminder_short") return DEFAULT_SECOND_REMINDER_MINUTES
  return DEFAULT_FIRST_REMINDER_MINUTES
}

function resolveReminderTimingMinutes(
  runtime: NotificationTemplateRuntime,
  reminderKind: string,
): number {
  if (runtime.timingMinutesBefore != null) return runtime.timingMinutesBefore
  return defaultTimingMinutesForReminderKind(reminderKind)
}

/** Mapuje rodzaj przypomnienia z kolejki na typ edytowalnego szablonu. */
function reminderTemplateTypeFromKind(kind: string): string {
  const k = kind.trim().toLowerCase()
  if (k === "second" || k === "appointment_reminder_short") return "reminder_before_visit"
  return "reminder_24h"
}

/** Zmienne podstawiane w treści szablonu SMS ({{imie}}, {{data}}, …). */
function buildReminderTemplateVars(
  booking: BookingRow,
  business: BusinessRow | null,
  manageUrl: string
): Record<string, string> {
  const { dateLabel, timeLabel } = formatPolishAppointmentLabel(
    booking.appointment_date,
    booking.appointment_time
  )
  const clientName = (booking.client_name ?? "").trim()
  const staffName = booking.staff_name ?? ""
  return {
    imie: clientName.split(/\s+/)[0] || clientName,
    data: dateLabel,
    godzina: timeLabel,
    usluga: (booking.service_name ?? "").trim(),
    osoba: getStaffDisplayName({ name: staffName }),
    imie_osoby: getStaffFirstName({ name: staffName }),
    ...buildBusinessTemplateVars(business, {
      link_potwierdzenia: manageUrl,
      link_anulowania: manageUrl,
    }),
  }
}

/** Dokleja adres firmy do treści, jeśli jeszcze go nie zawiera. */
function appendAddress(body: string, address: string, separator: string): string {
  const base = body.trim()
  if (!address || base.toLowerCase().includes(address.toLowerCase())) return base
  return `${base}${separator}Adres: ${address}`
}

/**
 * Treść SMS przypomnienia: jeśli firma ma zapisany własny szablon (smsBody),
 * używamy go (z podstawieniem zmiennych), w przeciwnym razie domyślnej treści.
 */
async function resolveReminderSms(
  runtime: NotificationTemplateRuntime,
  booking: BookingRow,
  business: BusinessRow | null,
  phone: string,
  manageUrl: string
): Promise<AppointmentReminderSmsResult> {
  if (runtime.smsBody && runtime.smsBody.trim().length > 0) {
    const vars = buildReminderTemplateVars(booking, business, manageUrl)
    const address = (business?.business_address ?? "").trim()
    const body = appendAddress(applyTemplateVariables(runtime.smsBody, vars), address, " ")
    if (body.length > 0) {
      return sendAppointmentReminderSmsPlainText({ to: phone, body })
    }
  }
  return sendAppointmentReminderSms({
    to: phone,
    businessName: resolveBusinessName(business),
    businessAddress: business?.business_address ?? null,
    serviceName: booking.service_name,
    appointmentDate: booking.appointment_date,
    appointmentTime: booking.appointment_time,
    manageUrl,
  })
}

/**
 * Treść e-mail przypomnienia: jeśli firma ma zapisany własny szablon (emailBody),
 * używamy go (temat + treść + HTML z podstawieniem zmiennych), w przeciwnym razie
 * domyślnego, sformatowanego maila.
 */
async function resolveReminderEmail(
  runtime: NotificationTemplateRuntime,
  booking: BookingRow,
  business: BusinessRow | null,
  recipient: string,
  manageUrl: string | null,
  replyTo: string | null
): Promise<AppointmentReminderEmailResult> {
  if (runtime.emailBody && runtime.emailBody.trim().length > 0) {
    const vars = buildReminderTemplateVars(booking, business, manageUrl ?? "")
    const address = (business?.business_address ?? "").trim()
    const text = appendAddress(
      applyTemplateVariables(runtime.emailBody, vars),
      address,
      "\n\n"
    )
    const subject =
      runtime.emailSubject && runtime.emailSubject.trim().length > 0
        ? applyTemplateVariables(runtime.emailSubject, vars)
        : "Przypomnienie o wizycie"
    const result = await sendReminderEmail({
      to: recipient,
      subject,
      textBody: text,
      htmlBody: plainTextEmailToHtml(text),
    })
    if (result.ok) {
      return { ok: true, provider: "resend", messageId: result.messageId ?? null }
    }
    // `simulated_dev` (brak klucza w devie) traktujemy jak brak konfiguracji,
    // żeby rekord wrócił do pending bez zliczania próby (jak w domyślnej ścieżce).
    const code = result.code === "failed" ? "failed" : "not_configured"
    return { ok: false, code, error: result.error ?? "email_send_failed" }
  }
  return sendAppointmentReminderEmail({
    to: recipient,
    businessName: resolveBusinessName(business),
    businessAddress: business?.business_address ?? null,
    appointmentDate: booking.appointment_date,
    appointmentTime: booking.appointment_time,
    serviceName: booking.service_name,
    staffName: booking.staff_name,
    clientName: booking.client_name,
    manageUrl,
    replyTo,
  })
}

async function isBookingTerminalNow(admin: AdminClient, bookingId: string): Promise<boolean> {
  const { data } = await admin
    .from("bookings")
    .select("status")
    .eq("id", bookingId)
    .maybeSingle()
  return isTerminalBookingStatus(data?.status)
}

/** Utrzymuje zgodność kolumn bookings.*_reminder_* z faktyczną wysyłką z kolejki. */
async function syncBookingLegacyReminderSent(
  admin: AdminClient,
  bookingId: string,
  reminderKind: string,
  sentAt: string,
): Promise<void> {
  const kind = reminderKind.trim().toLowerCase()
  const patch =
    kind === "second"
      ? { second_reminder_sent_at: sentAt, second_reminder_status: "sent" }
      : { first_reminder_sent_at: sentAt, first_reminder_status: "sent" }
  const { error } = await admin.from("bookings").update(patch).eq("id", bookingId)
  if (error) {
    console.warn("[cron/send-reminders] sync_booking_reminder_columns", {
      bookingId,
      message: error.message,
    })
  }
}

/** Legacy kolumny bookings ustawiamy dopiero, gdy wszystkie kanały tego przypomnienia są rozstrzygnięte. */
async function syncBookingLegacyReminderSentIfComplete(
  admin: AdminClient,
  bookingId: string,
  reminderKind: string,
): Promise<void> {
  const kind = reminderKind.trim().toLowerCase()
  const { data, error } = await admin
    .from("appointment_reminders")
    .select("status, sent_at")
    .eq("appointment_id", bookingId)
    .eq("reminder_kind", kind)
  if (error) {
    console.warn("[cron/send-reminders] sync_booking_reminder_check", {
      bookingId,
      message: error.message,
    })
    return
  }
  const rows = data ?? []
  if (rows.length === 0) return
  const open = rows.some((row) => {
    const status = (row.status ?? "").trim().toLowerCase()
    return status === "pending" || status === "processing"
  })
  if (open) return
  const sentAt = rows
    .map((row) => row.sent_at?.trim())
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  if (!sentAt) return
  await syncBookingLegacyReminderSent(admin, bookingId, reminderKind, sentAt)
}

// ---------------------------------------------------------------------------
// EMAIL
// ---------------------------------------------------------------------------
async function processEmailReminder(
  admin: AdminClient,
  item: DueReminderRow
): Promise<ProcessOutcome> {
  try {
    const load = await loadBookingAndBusiness(admin, item)
    if (!load.ok) {
      if (load.reason === "lookup_error") {
        return await recordFailure(admin, item, `booking_lookup_error: ${load.error ?? ""}`)
      }
      await markSkipped(
        admin,
        item,
        load.reason === "not_found" ? "booking_not_found" : "booking_cancelled",
        null,
      )
      return "skipped"
    }
    const { booking, business } = load

    const recipient = (booking.client_email ?? "").trim()
    if (recipient.length === 0) {
      await markSkipped(admin, item, "no_email", booking)
      return "skipped"
    }

    const runtime = await getTemplateRuntime(
      admin,
      item.business_id,
      reminderTemplateTypeFromKind(item.reminder_kind)
    )
    // Przypomnienia są domyślnie WŁĄCZONE. Pomijamy tylko, gdy firma sama
    // zapisała szablon i wyłączyła w nim ten kanał (status draft) — tak jak
    // pokazuje przełącznik „off" w kafelku szablonu.
    if (runtime.emailExists && !runtime.emailEnabled) {
      await markSkipped(
        admin,
        item,
        "template_email_disabled",
        booking,
        recipient,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    const replyTo =
      business?.email && business.email.trim().length > 0 ? business.email.trim() : null
    const manageUrl = resolveManageUrl(booking)

    if (await isBookingTerminalNow(admin, booking.id)) {
      await markSkipped(
        admin,
        item,
        "booking_cancelled_race",
        booking,
        recipient,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    if (
      isFirstReminderWindowPassed(
        item.reminder_kind,
        item.scheduled_for,
        booking.appointment_date,
        booking.appointment_time,
      )
    ) {
      await markSkipped(
        admin,
        item,
        "first_reminder_window_passed",
        booking,
        recipient,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    const emailResult: AppointmentReminderEmailResult = await resolveReminderEmail(
      runtime,
      booking,
      business,
      recipient,
      manageUrl,
      replyTo
    )

    if (emailResult.ok) {
      const sentAt = new Date().toISOString()
      const { error: updateError } = await admin
        .from("appointment_reminders")
        .update({
          status: "sent",
          sent_at: sentAt,
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
          channel: "email",
          message: updateError.message,
        })
      }
      const emailSubject =
        runtime.emailSubject && runtime.emailSubject.trim().length > 0
          ? applyTemplateVariables(
              runtime.emailSubject,
              buildReminderTemplateVars(booking, business, manageUrl ?? ""),
            )
          : "Przypomnienie o wizytie"
      await upsertReminderNotificationLog(
        admin,
        {
          businessId: item.business_id,
          bookingId: booking.id,
          reminderKind: item.reminder_kind,
          channel: "email",
          status: "sent",
          recipient,
          subject: emailSubject,
          provider: emailResult.provider,
          providerMessageId: emailResult.messageId,
          sentAt,
          timingMinutesBefore: resolveReminderTimingMinutes(runtime, item.reminder_kind),
        },
        "[cron/send-reminders.log]",
      )
      await syncBookingLegacyReminderSentIfComplete(admin, booking.id, item.reminder_kind)
      return "sent"
    }

    if (emailResult.code === "not_configured") {
      // Bez kluczy nie wysyłamy — odkładamy do następnego runa jako pending
      // bez zwiększania attempts, żeby po dodaniu env nie zrzucić wizyt do failed.
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

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------
async function processSmsReminder(
  admin: AdminClient,
  item: DueReminderRow
): Promise<ProcessOutcome> {
  try {
    const load = await loadBookingAndBusiness(admin, item)
    if (!load.ok) {
      if (load.reason === "lookup_error") {
        return await recordFailure(admin, item, `booking_lookup_error: ${load.error ?? ""}`)
      }
      await markSkipped(
        admin,
        item,
        load.reason === "not_found" ? "booking_not_found" : "booking_cancelled",
        null,
      )
      return "skipped"
    }
    const { booking, business } = load

    const phone = (booking.client_phone ?? "").trim()
    if (phone.length === 0) {
      await markSkipped(admin, item, "no_phone", booking)
      return "skipped"
    }

    const manageUrl = resolveManageUrl(booking)
    if (!manageUrl) {
      // Bez tokena nie ma sensownego SMS-a transakcyjnego — pomijamy.
      await markSkipped(admin, item, "no_manage_url", booking)
      return "skipped"
    }

    const runtime = await getTemplateRuntime(
      admin,
      item.business_id,
      reminderTemplateTypeFromKind(item.reminder_kind)
    )
    // Pomijamy tylko, gdy firma zapisała szablon SMS i wyłączyła go (status draft).
    if (runtime.smsExists && !runtime.smsEnabled) {
      await markSkipped(
        admin,
        item,
        "template_sms_disabled",
        booking,
        phone,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    // Wspólny miesięczny limit SMS-ów per firma (status='sent', sent_at w bieżącym
    // miesiącu kalendarzowym Europe/Warsaw). Liczone jest faktyczne wysłanie z OBU
    // źródeł: przypomnień (`appointment_reminders`) i własnych szablonów
    // (`custom_template_sends`). Pendings / processing / failed / skipped NIE wchodzą.
    const quota = await getSmsQuotaStatus(admin, item.business_id)
    if (quota.countFailed) {
      // Nie potrafimy policzyć — bezpieczniej traktować jak błąd techniczny
      // i pozwolić cronowi spróbować ponownie. Inaczej moglibyśmy nieświadomie
      // przekroczyć limit firmy.
      return await recordFailure(admin, item, "sms_quota_count_failed")
    }
    const monthlyLimit = quota.limit
    const used = quota.used
    if (!quota.allowed) {
      await markSkipped(
        admin,
        item,
        "sms_monthly_limit_reached",
        booking,
        phone,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      console.info("[cron/send-reminders] sms_limit_reached", {
        id: item.id,
        business_id: item.business_id,
        used,
        limit: monthlyLimit,
      })
      return "skipped"
    }

    if (await isBookingTerminalNow(admin, booking.id)) {
      await markSkipped(
        admin,
        item,
        "booking_cancelled_race",
        booking,
        phone,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    if (
      isFirstReminderWindowPassed(
        item.reminder_kind,
        item.scheduled_for,
        booking.appointment_date,
        booking.appointment_time,
      )
    ) {
      await markSkipped(
        admin,
        item,
        "first_reminder_window_passed",
        booking,
        phone,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    const smsResult: AppointmentReminderSmsResult = await resolveReminderSms(
      runtime,
      booking,
      business,
      phone,
      manageUrl
    )

    if (smsResult.ok) {
      const sentAt = new Date().toISOString()
      const { error: updateError } = await admin
        .from("appointment_reminders")
        .update({
          status: "sent",
          sent_at: sentAt,
          provider: smsResult.provider,
          provider_message_id: smsResult.messageId,
          locked_at: null,
          last_error: null,
          attempts: item.attempts + 1,
        })
        .eq("id", item.id)
      if (updateError) {
        console.error("[cron/send-reminders] update_sent_failed", {
          id: item.id,
          channel: "sms",
          message: updateError.message,
        })
      }
      await upsertReminderNotificationLog(
        admin,
        {
          businessId: item.business_id,
          bookingId: booking.id,
          reminderKind: item.reminder_kind,
          channel: "sms",
          status: "sent",
          recipient: phone,
          provider: smsResult.provider,
          providerMessageId: smsResult.messageId,
          sentAt,
          timingMinutesBefore: resolveReminderTimingMinutes(runtime, item.reminder_kind),
        },
        "[cron/send-reminders.log]",
      )
      await syncBookingLegacyReminderSentIfComplete(admin, booking.id, item.reminder_kind)
      return "sent"
    }

    if (smsResult.code === "not_configured") {
      // Bez SMSAPI_TOKEN — odłóż jako pending bez attempts++. Analogicznie do email.
      await admin
        .from("appointment_reminders")
        .update({
          status: "pending",
          locked_at: null,
          last_error: smsResult.error,
        })
        .eq("id", item.id)
      return "failed"
    }

    if (smsResult.code === "invalid_phone") {
      // Telefon istniał w bazie, ale nie potrafimy go znormalizować do MSISDN.
      // To trwała wada danych — `skipped` (a nie retry), żeby nie napierać na
      // SMSAPI z każdym uruchomieniem crona.
      await markSkipped(
        admin,
        item,
        smsResult.error || "invalid_phone",
        booking,
        phone,
        resolveReminderTimingMinutes(runtime, item.reminder_kind),
      )
      return "skipped"
    }

    return await recordFailure(admin, item, smsResult.error)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error"
    return await recordFailure(admin, item, msg)
  }
}

// ---------------------------------------------------------------------------
// Common state transitions
// ---------------------------------------------------------------------------
async function markSkipped(
  admin: AdminClient,
  item: DueReminderRow,
  reason: string,
  booking: BookingRow | null,
  recipient?: string | null,
  timingMinutesBefore?: number | null,
): Promise<void> {
  const { error } = await admin
    .from("appointment_reminders")
    .update({
      status: "skipped",
      skipped_at: new Date().toISOString(),
      locked_at: null,
      last_error: reason,
    })
    .eq("id", item.id)
  if (error) {
    console.error("[cron/send-reminders] mark_skipped_failed", {
      reminderId: item.id,
      message: error.message,
    })
  }
  if (booking?.id) {
    await upsertReminderNotificationLog(
      admin,
      {
        businessId: item.business_id,
        bookingId: booking.id,
        reminderKind: item.reminder_kind,
        channel: item.channel === "sms" ? "sms" : "email",
        status: "skipped",
        recipient: recipient ?? null,
        errorMessage: reason,
        sentAt: new Date().toISOString(),
        timingMinutesBefore:
          timingMinutesBefore ?? defaultTimingMinutesForReminderKind(item.reminder_kind),
      },
      "[cron/send-reminders.log]",
    )
    await syncBookingLegacyReminderSentIfComplete(admin, booking.id, item.reminder_kind)
  }
}

async function recordFailure(
  admin: AdminClient,
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
