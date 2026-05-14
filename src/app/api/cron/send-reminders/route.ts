import { NextResponse, type NextRequest } from "next/server"

import {
  sendAppointmentReminderEmail,
  type AppointmentReminderEmailResult,
} from "@/lib/notifications/appointment-reminder-email"
import {
  getActiveSmsReminderProvider,
  sendAppointmentReminderSms,
  type AppointmentReminderSmsResult,
} from "@/lib/notifications/appointment-reminder-sms"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BATCH_SIZE = 20
const MAX_ATTEMPTS = 3
const DEFAULT_SMS_MONTHLY_LIMIT = 100

/**
 * Cron wysyłający przypomnienia (e-mail oraz SMS) z kolejki `appointment_reminders`.
 *
 * Wymagane envy (e‑mail, etap 1):
 *   - CRON_SECRET
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   - RESEND_API_KEY
 *   - REMINDERS_FROM_EMAIL (opcjonalnie; fallback RESEND_FROM, a finalnie default w helperze)
 *
 * Dodatkowe envy (SMS, etap 2):
 *   - SMS_REMINDERS_ENABLED        — musi być dokładnie `true`, żeby cron w ogóle
 *     brał do paczki rekordy `channel='sms'`. Brak zmiennej / inna wartość = SMS
 *     pozostają `pending` (nigdy nie lockowane), e‑mail bez zmian. MVP produkcyjne.
 *   - SMS_REMINDERS_ALLOWED_BUSINESS_IDS — opcjonalnie, gdy SMS włączone: lista
 *     `uuid,uuid,...`; tylko te firmy mają SMS w paczce crona. Puste / nieustawione =
 *     wszystkie firmy. SMS spoza listy zostaje `pending` (bez locka, bez wysyłki).
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
  email: string | null
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

/**
 * Limit faktycznie wysłanych SMS-ów per firma per kalendarzowy miesiąc.
 * Konfigurowalny przez env `SMS_MONTHLY_INCLUDED_LIMIT`; fallback 100.
 * Negatywne / niesensowne wartości spadają do fallbacku.
 */
function getSmsMonthlyLimit(): number {
  const raw = process.env.SMS_MONTHLY_INCLUDED_LIMIT?.trim()
  if (!raw) return DEFAULT_SMS_MONTHLY_LIMIT
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_SMS_MONTHLY_LIMIT
  return Math.floor(parsed)
}

/** Tylko `SMS_REMINDERS_ENABLED=true` włącza pobieranie i wysyłkę SMS z kolejki. */
function areSmsRemindersEnabled(): boolean {
  return process.env.SMS_REMINDERS_ENABLED?.trim() === "true"
}

const SMS_ALLOWED_BUSINESS_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Allowlista firm dla SMS (gdy `SMS_REMINDERS_ENABLED=true`).
 * - `null` — zmienna pusta / nieustawiona / same puste tokeny → SMS dla wszystkich firm.
 * - niepusta tablica — tylko te `business_id` (SMS innych nie trafia do SELECT).
 * - `[]` — env niepuste, ale brak poprawnych UUID → w praktyce tylko e‑mail w paczce.
 */
function parseSmsAllowedBusinessIds(): string[] | null {
  const raw = process.env.SMS_REMINDERS_ALLOWED_BUSINESS_IDS?.trim()
  if (!raw) return null
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const valid = parts.filter((id) => SMS_ALLOWED_BUSINESS_UUID_RE.test(id))
  if (valid.length === 0) return []
  return valid
}

/**
 * Zwraca UTC ISO odpowiadający początkowi bieżącego miesiąca w strefie
 * Europe/Warsaw. Używamy go jako dolnej granicy zliczania SMS-ów `sent`
 * w bieżącym kalendarzowym miesiącu firmy.
 */
function startOfMonthInWarsawIso(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now)
  const yearStr = parts.find((p) => p.type === "year")?.value
  const monthStr = parts.find((p) => p.type === "month")?.value
  if (!yearStr || !monthStr) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)
    ).toISOString()
  }
  // Probe: 1st of that month at 00:00 UTC. The Warsaw hour of this instant
  // equals the current Warsaw offset (1 = CET, 2 = CEST).
  const probe = new Date(`${yearStr}-${monthStr}-01T00:00:00Z`)
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour: "2-digit",
    hour12: false,
  }).format(probe)
  const offsetHours = Number.parseInt(hourStr, 10)
  const safeOffset = Number.isFinite(offsetHours) ? offsetHours : 1
  return new Date(probe.getTime() - safeOffset * 3_600_000).toISOString()
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
  const smsAllowedBusinessIds = smsRemindersEnabled ? parseSmsAllowedBusinessIds() : null

  // 1. Wybieramy partię pending przypomnień gotowych do wysłania.
  //    SMS: tylko przy SMS_REMINDERS_ENABLED=true; opcjonalnie dodatkowo allowlista
  //    SMS_REMINDERS_ALLOWED_BUSINESS_IDS — inne SMS zostają pending (poza SELECT).
  //    E‑mail zawsze w paczce (subject do tych samych filtrów czasu / attempts).
  let dueQuery = admin
    .from("appointment_reminders")
    .select("id, business_id, appointment_id, channel, reminder_kind, scheduled_for, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .lt("attempts", MAX_ATTEMPTS)
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE)

  if (!smsRemindersEnabled) {
    dueQuery = dueQuery.eq("channel", "email")
  } else if (smsAllowedBusinessIds === null) {
    dueQuery = dueQuery.in("channel", ["email", "sms"])
  } else if (smsAllowedBusinessIds.length === 0) {
    dueQuery = dueQuery.eq("channel", "email")
  } else {
    const inList = smsAllowedBusinessIds.join(",")
    dueQuery = dueQuery.or(
      `channel.eq.email,and(channel.eq.sms,business_id.in.(${inList}))`
    )
  }

  const { data: dueRows, error: dueError } = await dueQuery

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
    sms_allowed_business_ids: !smsRemindersEnabled
      ? "n/a"
      : smsAllowedBusinessIds === null
        ? "all"
        : smsAllowedBusinessIds.length === 0
          ? "none_valid_uuid"
          : smsAllowedBusinessIds.join(","),
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
  if (booking.status === "cancelled") {
    return { ok: false, reason: "booking_cancelled" }
  }

  const { data: businessRaw } = await admin
    .from("business_profiles")
    .select("id, business_name, email")
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
        item.id,
        load.reason === "not_found" ? "booking_not_found" : "booking_cancelled"
      )
      return "skipped"
    }
    const { booking, business } = load

    const recipient = (booking.client_email ?? "").trim()
    if (recipient.length === 0) {
      await markSkipped(admin, item.id, "no_email")
      return "skipped"
    }

    const businessName = resolveBusinessName(business)
    const replyTo =
      business?.email && business.email.trim().length > 0 ? business.email.trim() : null
    const manageUrl = resolveManageUrl(booking)

    const emailResult: AppointmentReminderEmailResult = await sendAppointmentReminderEmail({
      to: recipient,
      businessName,
      appointmentDate: booking.appointment_date,
      appointmentTime: booking.appointment_time,
      serviceName: booking.service_name,
      staffName: booking.staff_name,
      clientName: booking.client_name,
      manageUrl,
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
          channel: "email",
          message: updateError.message,
        })
      }
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
        item.id,
        load.reason === "not_found" ? "booking_not_found" : "booking_cancelled"
      )
      return "skipped"
    }
    const { booking, business } = load

    const phone = (booking.client_phone ?? "").trim()
    if (phone.length === 0) {
      await markSkipped(admin, item.id, "no_phone")
      return "skipped"
    }

    const manageUrl = resolveManageUrl(booking)
    if (!manageUrl) {
      // Bez tokena nie ma sensownego SMS-a transakcyjnego — pomijamy.
      await markSkipped(admin, item.id, "no_manage_url")
      return "skipped"
    }

    // Limit miesięczny SMS-ów per firma (status='sent', sent_at w bieżącym
    // miesiącu kalendarzowym Europe/Warsaw). Liczone jest faktyczne wysłanie.
    // Pendings / processing / failed / skipped NIE wchodzą do liczenia.
    const monthlyLimit = getSmsMonthlyLimit()
    const monthStartIso = startOfMonthInWarsawIso(new Date())

    const { count: usedRaw, error: countError } = await admin
      .from("appointment_reminders")
      .select("id", { count: "exact", head: true })
      .eq("business_id", item.business_id)
      .eq("channel", "sms")
      .eq("status", "sent")
      .gte("sent_at", monthStartIso)

    if (countError) {
      // Nie potrafimy policzyć — bezpieczniej traktować jak błąd techniczny
      // i pozwolić cronowi spróbować ponownie. Inaczej moglibyśmy nieświadomie
      // przekroczyć limit firmy.
      return await recordFailure(admin, item, `sms_quota_count_failed: ${countError.message}`)
    }
    const used = usedRaw ?? 0
    if (used >= monthlyLimit) {
      // To NIE jest błąd techniczny — to decyzja biznesowa, więc:
      //   • status = 'skipped',
      //   • last_error = 'sms_monthly_limit_reached',
      //   • provider = aktywny SMS (smsapi | szybkisms),
      //   • NIE zwiększamy attempts — kolejne uruchomienia crona i tak nie
      //     spojrzą na ten rekord (status='skipped' jest poza WHERE w SELECT).
      const { error: limitErr } = await admin
        .from("appointment_reminders")
        .update({
          status: "skipped",
          skipped_at: new Date().toISOString(),
          locked_at: null,
          last_error: "sms_monthly_limit_reached",
          provider: getActiveSmsReminderProvider(),
        })
        .eq("id", item.id)
      if (limitErr) {
        console.error("[cron/send-reminders] sms_limit_mark_failed", {
          id: item.id,
          message: limitErr.message,
        })
      } else {
        console.info("[cron/send-reminders] sms_limit_reached", {
          id: item.id,
          business_id: item.business_id,
          used,
          limit: monthlyLimit,
        })
      }
      return "skipped"
    }

    const businessName = resolveBusinessName(business)
    const smsResult: AppointmentReminderSmsResult = await sendAppointmentReminderSms({
      to: phone,
      businessName,
      appointmentDate: booking.appointment_date,
      appointmentTime: booking.appointment_time,
      manageUrl,
    })

    if (smsResult.ok) {
      const { error: updateError } = await admin
        .from("appointment_reminders")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
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
      await markSkipped(admin, item.id, smsResult.error || "invalid_phone")
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
