import { sendReminderEmail } from "@/lib/notifications/email"
import { getActiveSmsReminderProvider } from "@/lib/notifications/appointment-reminder-sms"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { insertNotificationLog } from "@/lib/notifications/notification-log-insert"
import { upsertNotificationLog } from "@/lib/notifications/notification-log-update"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import { dispatchCustomTemplatesForEvent } from "@/lib/notifications/custom-templates-dispatch"
import { applyTemplateVariables, getTemplateRuntime } from "@/lib/notifications/template-runtime"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import {
  evaluateSmsQuotaForSend,
  isSmsMonthlyLimitExhausted,
  SMS_MONTHLY_LIMIT_REACHED,
} from "@/lib/notifications/sms-quota-guard"
import { queueGoogleCalendarBookingSync } from "@/lib/integrations/google-calendar/sync-booking-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type BookingCreatedChannelStatus =
  | "sent"
  | "failed"
  | "skipped"
  | "missing"
  | "already_sent"

export type BookingCreatedChannelDetail = {
  status: BookingCreatedChannelStatus
  error_message?: string | null
  code?: string | null
  provider?: string | null
}

export type BookingCreatedNotifyResult = {
  ok: boolean
  email: BookingCreatedChannelDetail
  sms: BookingCreatedChannelDetail
}

type BookingRow = {
  id: string
  business_id: string
  confirmation_token: string
  service_name: string
  appointment_date: string
  appointment_time: string
  client_name: string
  client_phone: string | null
  client_email: string | null
}

type BusinessRow = {
  slug: string | null
  business_name: string | null
  phone: string | null
  contact_phone: string | null
  business_address: string | null
}

function getPublicAppOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

function formatDateLabel(date: string, language: "pl" | "en"): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date.slice(0, 10)
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

function formatTimeHmFromDb(t: string): string {
  const m = String(t).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function formatAppointmentDateTime(
  appointmentDate: string,
  appointmentTime: string,
  language: "pl" | "en",
): string {
  const dateLabel = formatDateLabel(appointmentDate, language)
  const timeHm = formatTimeHmFromDb(appointmentTime)
  if (language === "en") return `${dateLabel}, ${timeHm}`
  return `${dateLabel}, ${timeHm}`
}

function buildConfirmUrl(confirmationToken: string): string {
  return `${getPublicAppOrigin()}/confirm/${encodeURIComponent(confirmationToken)}?source=booking`
}

function readOptionalString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

function formatProviderFailure(code: string, detail?: string): string {
  const c = code.trim()
  const d = detail?.trim()
  if (c && d) return `${c}: ${d}`
  return d || c || "send_failed"
}

function mapProviderLogStatus(ok: boolean, code?: string): string {
  if (ok) return "sent"
  const c = (code ?? "").trim()
  if (c === "simulated_dev" || c === "not_configured" || c === "skipped") return c
  return "failed"
}

function smsEnvDiagnostics(): Record<string, unknown> {
  const provider = getActiveSmsReminderProvider()
  return {
    sms_provider: provider,
    SMS_PROVIDER: process.env.SMS_PROVIDER?.trim() || "(default smsapi)",
    has_SMSAPI_TOKEN: Boolean(process.env.SMSAPI_TOKEN?.trim()),
    has_SZYBKISMS_TOKEN: Boolean(process.env.SZYBKISMS_TOKEN?.trim()),
  }
}

function channelDetail(
  status: BookingCreatedChannelStatus,
  extra?: Partial<BookingCreatedChannelDetail>,
): BookingCreatedChannelDetail {
  return { status, ...extra }
}

function buildMessages(
  booking: BookingRow,
  business: BusinessRow | null,
  language: "pl" | "en",
  confirmUrl: string,
) {
  const serviceName = booking.service_name.trim()
  const clientName = booking.client_name.trim()
  const appointmentDateTime = formatAppointmentDateTime(
    String(booking.appointment_date),
    String(booking.appointment_time),
    language,
  )
  const businessAddress = business?.business_address?.trim() ?? ""

  const detailRows = language === "en"
    ? [
        { label: "Service", value: serviceName },
        { label: "Date and time", value: appointmentDateTime },
        { label: "Client", value: clientName },
        ...(businessAddress ? [{ label: "Address", value: businessAddress }] : []),
      ]
    : [
        { label: "Usługa", value: serviceName },
        { label: "Termin", value: appointmentDateTime },
        { label: "Klient", value: clientName },
        ...(businessAddress ? [{ label: "Adres", value: businessAddress }] : []),
      ]

  const emailSubject = language === "en" ? "Appointment confirmed" : "Wizyta potwierdzona"
  const intro =
    language === "en"
      ? "Your appointment has been confirmed."
      : "Twoja wizyta została potwierdzona."
  const cta =
    language === "en"
      ? {
          href: confirmUrl,
          label: "Manage appointment",
          hint: "Use this link to view appointment details or cancel if you cannot attend.",
        }
      : {
          href: confirmUrl,
          label: "Zarządzaj wizytą",
          hint: "Pod tym linkiem możesz sprawdzić szczegóły wizyty lub anulować wizytę, jeśli nie możesz przyjść.",
        }

  const emailText = buildTransactionalEmailText({
    lang: language,
    intro,
    detailRows,
    cta,
  })
  const emailHtml = buildTransactionalEmailHtml({
    lang: language,
    subject: emailSubject,
    preheader:
      language === "en"
        ? `Appointment confirmed — ${appointmentDateTime}.`
        : `Wizyta potwierdzona — ${appointmentDateTime}.`,
    title: emailSubject,
    intro,
    detailRows,
    cta,
  })

  return {
    sms:
      language === "en"
        ? `Appointment confirmed: ${serviceName}, ${appointmentDateTime}.${businessAddress ? ` Address: ${businessAddress}.` : ""} Manage or cancel: ${confirmUrl}`
        : `Wizyta potwierdzona: ${serviceName}, ${appointmentDateTime}.${businessAddress ? ` Adres: ${businessAddress}.` : ""} Zarządzaj wizytą lub anuluj ją tutaj: ${confirmUrl}`,
    emailSubject,
    emailText,
    emailHtml,
  }
}

type ChannelLogRow = {
  status: string | null
  error_message: string | null
  provider: string | null
  provider_message_id: string | null
}

/** Wiersze `sent` bez providera to backfill historyczny (migr. 063) — nie blokuj ponownej wysyłki. */
function isGenuineSentLog(row: ChannelLogRow | undefined): boolean {
  if (!row || row.status !== "sent") return false
  return Boolean(row.provider_message_id?.trim() || row.provider?.trim())
}

function mapLogRowStatus(row: ChannelLogRow | undefined): BookingCreatedChannelStatus {
  if (!row) return "missing"
  const status = row.status ?? ""
  if (status === "skipped") return "skipped"
  if (status === "sent") return isGenuineSentLog(row) ? "sent" : "missing"
  // In-flight claim — nie uruchamiaj drugiej wysyłki równoległej.
  if (status === "queued" || status === "pending") return "already_sent"
  if (status === "failed") return "failed"
  return "failed"
}

function channelSendSettled(status: BookingCreatedChannelStatus): boolean {
  return status === "sent" || status === "skipped" || status === "already_sent"
}

async function persistChannelLog(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  booking: BookingRow,
  channel: "email" | "sms",
  recipient: string,
  patch: {
    status: string
    subject: string | null
    body: string | null
    provider?: string | null
    provider_message_id?: string | null
    error_message?: string | null
    sent_at?: string | null
  },
): Promise<void> {
  await upsertNotificationLog(
    admin,
    { booking_id: booking.id, type: "booking_created", channel },
    {
      business_id: booking.business_id,
      booking_id: booking.id,
      channel,
      type: "booking_created",
      recipient,
      subject: patch.subject,
      body: patch.body,
      provider: patch.provider ?? null,
      provider_message_id: patch.provider_message_id ?? null,
      error_message: patch.error_message ?? null,
      sent_at: patch.sent_at ?? null,
      status: patch.status,
    },
    { ...patch, recipient },
    "[booking-created.notify.log]",
  )
}

function channelNeedsSendAttempt(status: BookingCreatedChannelStatus): boolean {
  return !channelSendSettled(status)
}

async function loadChannelLogRow(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  bookingId: string,
  channel: "email" | "sms",
): Promise<ChannelLogRow | undefined> {
  const { data } = await admin
    .from("notification_logs")
    .select("status, error_message, provider, provider_message_id")
    .eq("booking_id", bookingId)
    .eq("type", "booking_created")
    .eq("channel", channel)
    .maybeSingle()
  return data ?? undefined
}

/** Jedno równoległe wywołanie na kanał — bez podwójnej wysyłki (strona rezerwacji + sukces). */
async function claimBookingCreatedChannel(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  booking: BookingRow,
  channel: "email" | "sms",
  recipient: string,
): Promise<"send" | "skip"> {
  const existing = await loadChannelLogRow(admin, booking.id, channel)
  if (isGenuineSentLog(existing)) return "skip"

  const insertBase = {
    business_id: booking.business_id,
    booking_id: booking.id,
    channel,
    type: "booking_created" as const,
    recipient,
    subject: null,
    body: null,
    provider: null,
    provider_message_id: null,
    sent_at: null,
  }

  const claim = await insertNotificationLog(
    admin,
    { ...insertBase, status: "pending" },
    "[booking-created.notify.log]",
  )
  if (claim.ok && !claim.duplicate) return "send"

  const current = await loadChannelLogRow(admin, booking.id, channel)
  if (isGenuineSentLog(current)) return "skip"
  // Inny równoległy request już claimuje ten kanał — nie wysyłaj drugi raz.
  if (current?.status === "pending" || current?.status === "queued") return "skip"

  if (!claim.ok) return "send"

  await persistChannelLog(admin, booking, channel, recipient, {
    status: "pending",
    subject: null,
    body: null,
    error_message: null,
    sent_at: null,
  })
  return "send"
}

export async function getBookingCreatedNotifyStatus(
  bookingId: string,
): Promise<BookingCreatedNotifyResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    return {
      ok: false,
      email: channelDetail("failed", { error_message: "service_role_missing" }),
      sms: channelDetail("failed", { error_message: "service_role_missing" }),
    }
  }
  const id = bookingId.trim()
  if (!id) {
    return {
      ok: false,
      email: channelDetail("missing"),
      sms: channelDetail("missing"),
    }
  }

  const { data: logs } = await admin
    .from("notification_logs")
    .select("channel, status, error_message, provider, provider_message_id")
    .eq("booking_id", id)
    .eq("type", "booking_created")

  const emailRow = (logs ?? []).find((r) => r.channel === "email")
  const smsRow = (logs ?? []).find((r) => r.channel === "sms")

  return {
    ok: true,
    email: emailRow
      ? channelDetail(mapLogRowStatus(emailRow), {
          error_message: emailRow.error_message,
          provider: emailRow.provider,
        })
      : channelDetail("missing"),
    sms: smsRow
      ? channelDetail(mapLogRowStatus(smsRow), {
          error_message: smsRow.error_message,
          provider: smsRow.provider,
        })
      : channelDetail("missing"),
  }
}

export async function sendBookingCreatedNotifications(
  confirmationToken: string,
  language: "pl" | "en",
): Promise<BookingCreatedNotifyResult> {
  const admin = getServiceRoleClient()
  if (!admin) {
    console.error("[booking-created.notify] service_role_missing")
    return {
      ok: false,
      email: channelDetail("failed", { error_message: "service_role_missing" }),
      sms: channelDetail("failed", { error_message: "service_role_missing" }),
    }
  }

  const token = confirmationToken.trim()
  if (!token) {
    return {
      ok: false,
      email: channelDetail("missing"),
      sms: channelDetail("missing"),
    }
  }

  const { data: bookingRaw, error: bookingErr } = await admin.rpc("get_booking_by_confirmation_token", {
    p_token: token,
  })
  if (bookingErr || !bookingRaw || typeof bookingRaw !== "object") {
    console.error("[booking-created.notify] booking_not_found", bookingErr?.message)
    return {
      ok: false,
      email: channelDetail("failed", { error_message: bookingErr?.message ?? "booking_not_found" }),
      sms: channelDetail("failed", { error_message: bookingErr?.message ?? "booking_not_found" }),
    }
  }

  const o = bookingRaw as Record<string, unknown>
  const booking: BookingRow = {
    id: String(o.id ?? ""),
    business_id: String(o.business_id ?? ""),
    confirmation_token: String(o.confirmation_token ?? token),
    service_name: String(o.service_name ?? ""),
    appointment_date: String(o.appointment_date ?? ""),
    appointment_time: String(o.appointment_time ?? ""),
    client_name: String(o.client_name ?? ""),
    client_phone: readOptionalString(o.client_phone),
    client_email: readOptionalString(o.client_email),
  }

  if (!booking.id || !booking.business_id) {
    return {
      ok: false,
      email: channelDetail("failed", { error_message: "booking_row_invalid" }),
      sms: channelDetail("failed", { error_message: "booking_row_invalid" }),
    }
  }

  queueGoogleCalendarBookingSync(booking.id, "upsert")

  const existing = await getBookingCreatedNotifyStatus(booking.id)
  if (!channelNeedsSendAttempt(existing.email.status) && !channelNeedsSendAttempt(existing.sms.status)) {
    return { ok: true, email: existing.email, sms: existing.sms }
  }

  const { data: businessRaw } = await admin
    .from("business_profiles")
    .select("slug,business_name,phone,contact_phone,business_address")
    .eq("id", booking.business_id)
    .maybeSingle()
  const business =
    businessRaw && typeof businessRaw === "object"
      ? (businessRaw as BusinessRow)
      : null

  const confirmUrl = buildConfirmUrl(booking.confirmation_token)
  const fallbackMessages = buildMessages(booking, business, language, confirmUrl)
  const templateRuntime = await getTemplateRuntime(admin, booking.business_id, "booking_confirmation")
  const dateLabel = String(booking.appointment_date).slice(0, 10)
  const timeHm = formatTimeHmFromDb(booking.appointment_time)
  const templateVars: Record<string, string> = {
    imie: booking.client_name.split(/\s+/)[0] || booking.client_name,
    data: dateLabel,
    godzina: timeHm,
    usluga: booking.service_name,
    osoba: "",
    ...buildBusinessTemplateVars(business, {
      link_potwierdzenia: confirmUrl,
      link_anulowania: confirmUrl,
    }),
  }
  const messages = {
    emailSubject:
      templateRuntime.emailSubject && templateRuntime.emailSubject.trim().length > 0
        ? applyTemplateVariables(templateRuntime.emailSubject, templateVars)
        : fallbackMessages.emailSubject,
    emailText:
      templateRuntime.emailBody && templateRuntime.emailBody.trim().length > 0
        ? applyTemplateVariables(templateRuntime.emailBody, templateVars)
        : fallbackMessages.emailText,
    emailHtml:
      templateRuntime.emailBody && templateRuntime.emailBody.trim().length > 0
        ? plainTextEmailToHtml(applyTemplateVariables(templateRuntime.emailBody, templateVars))
        : fallbackMessages.emailHtml,
    sms:
      templateRuntime.smsBody && templateRuntime.smsBody.trim().length > 0
        ? applyTemplateVariables(templateRuntime.smsBody, templateVars)
        : fallbackMessages.sms,
  }
  const wantEmail = templateRuntime.emailExists ? templateRuntime.emailEnabled : true
  const wantSms = templateRuntime.smsExists ? templateRuntime.smsEnabled : true
  const nowIso = new Date().toISOString()

  let emailResult = existing.email
  let smsResult = existing.sms
  let dispatchedCustomTemplates = false

  const email = booking.client_email ?? ""
  if (!channelNeedsSendAttempt(existing.email.status)) {
    emailResult = existing.email
  } else if (!wantEmail) {
    emailResult = channelDetail("skipped")
    if (email) {
      await persistChannelLog(admin, booking, "email", email, {
        status: "skipped",
        subject: null,
        body: null,
        error_message: "channel_disabled",
        sent_at: null,
      })
    }
  } else if (!email) {
    emailResult = channelDetail("skipped")
    await persistChannelLog(admin, booking, "email", "", {
      status: "skipped",
      subject: null,
      body: null,
      error_message: "missing_email",
      sent_at: null,
    })
  } else {
    const claim = await claimBookingCreatedChannel(admin, booking, "email", email)
    if (claim === "skip") {
      emailResult = channelDetail("already_sent", { provider: "resend" })
    } else {
      try {
        const sent = await sendReminderEmail({
        to: email,
        subject: messages.emailSubject,
        textBody: messages.emailText,
        htmlBody: messages.emailHtml,
      })
      const logStatus = mapProviderLogStatus(sent.ok, sent.ok ? undefined : sent.code)
      const errorMessage = sent.ok ? null : formatProviderFailure(sent.code, sent.error)
      emailResult = sent.ok
        ? channelDetail("sent", { provider: sent.provider })
        : channelDetail("failed", {
            error_message: errorMessage,
            code: sent.code,
            provider: "resend",
          })

      await persistChannelLog(admin, booking, "email", email, {
        status: logStatus,
        subject: messages.emailSubject,
        body: messages.emailText,
        provider: sent.ok ? sent.provider : null,
        provider_message_id: sent.ok ? sent.messageId ?? null : null,
        error_message: errorMessage,
        sent_at: sent.ok ? nowIso : null,
      })
      if (sent.ok) {
        dispatchedCustomTemplates = true
      }
      if (!sent.ok) {
        console.error("[booking-created.notify.email]", sent.code, sent.error ?? "")
      }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "unknown_error"
        console.error("[booking-created.notify.email]", errMsg)
        emailResult = channelDetail("failed", { error_message: errMsg })
        await persistChannelLog(admin, booking, "email", email, {
          status: "failed",
          subject: messages.emailSubject,
          body: messages.emailText,
          error_message: errMsg,
          sent_at: null,
        })
      }
    }
  }

  const phone = booking.client_phone ?? ""
  const smsProvider = getActiveSmsReminderProvider()
  if (!channelNeedsSendAttempt(existing.sms.status)) {
    smsResult = existing.sms
  } else if (!wantSms) {
    smsResult = channelDetail("skipped")
    if (phone) {
      await persistChannelLog(admin, booking, "sms", phone, {
        status: "skipped",
        subject: null,
        body: null,
        error_message: "channel_disabled",
        sent_at: null,
      })
    }
  } else if (!phone) {
    smsResult = channelDetail("skipped")
    await persistChannelLog(admin, booking, "sms", "", {
      status: "skipped",
      subject: null,
      body: null,
      error_message: "missing_phone",
      sent_at: null,
    })
  } else {
    const claim = await claimBookingCreatedChannel(admin, booking, "sms", phone)
    if (claim === "skip") {
      smsResult = channelDetail("already_sent", { provider: smsProvider })
    } else {
      const quotaDecision = await evaluateSmsQuotaForSend(admin, booking.business_id)
      if (isSmsMonthlyLimitExhausted(quotaDecision.quota)) {
        smsResult = channelDetail("skipped")
        await persistChannelLog(admin, booking, "sms", phone, {
          status: "skipped",
          subject: null,
          body: messages.sms,
          error_message: SMS_MONTHLY_LIMIT_REACHED,
          sent_at: null,
        })
      } else {
      try {
        const sent = await sendPlainTransactionalSms({ to: phone, body: messages.sms })
      const logStatus = mapProviderLogStatus(sent.ok, sent.ok ? undefined : sent.code)
      const errorMessage = sent.ok ? null : formatProviderFailure(sent.code, sent.error)
      smsResult = sent.ok
        ? channelDetail("sent", { provider: sent.provider })
        : channelDetail("failed", {
            error_message: errorMessage,
            code: sent.code,
            provider: smsProvider,
          })

      await persistChannelLog(admin, booking, "sms", phone, {
        status: logStatus,
        subject: null,
        body: messages.sms,
        provider: sent.ok ? sent.provider : null,
        provider_message_id: sent.ok ? sent.messageId ?? null : null,
        error_message: errorMessage,
        sent_at: sent.ok ? nowIso : null,
      })
      if (sent.ok) {
        dispatchedCustomTemplates = true
      }
      if (!sent.ok) {
        console.error("[booking-created.notify.sms]", {
          code: sent.code,
          error: sent.error,
          recipient: phone,
          ...smsEnvDiagnostics(),
        })
      }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "unknown_error"
        console.error("[booking-created.notify.sms]", {
          error: errMsg,
          recipient: phone,
          ...smsEnvDiagnostics(),
        })
        smsResult = channelDetail("failed", {
          error_message: errMsg,
          provider: smsProvider,
        })
        await persistChannelLog(admin, booking, "sms", phone, {
          status: "failed",
          subject: null,
          body: messages.sms,
          error_message: errMsg,
          sent_at: null,
        })
      }
      }
    }
  }

  // Własne szablony typu „zdarzenie" tylko przy pierwszej udanej wysyłce wbudowanego potwierdzenia.
  if (dispatchedCustomTemplates) {
    try {
      await dispatchCustomTemplatesForEvent({ bookingId: booking.id, eventKey: "created" })
    } catch {
      // brak wpływu na wynik wbudowanego potwierdzenia
    }
  }

  return {
    ok: true,
    email: emailResult,
    sms: smsResult,
  }
}
