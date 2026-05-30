import { sendReminderEmail } from "@/lib/notifications/email"
import { getActiveSmsReminderProvider } from "@/lib/notifications/appointment-reminder-sms"
import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { insertNotificationLog } from "@/lib/notifications/notification-log-insert"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import { dispatchCustomTemplatesForEvent } from "@/lib/notifications/custom-templates-dispatch"
import { applyTemplateVariables, getTemplateRuntime } from "@/lib/notifications/template-runtime"
import {
  buildTransactionalEmailHtml,
  buildTransactionalEmailText,
} from "@/lib/notifications/transactional-email-layout"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
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

type ClaimResult = "claimed" | "already_sent" | "in_flight"

/**
 * Atomowo „zaklepuje" wysyłkę danego kanału, wstawiając wiersz logu ze statusem
 * `queued`. Dzięki unikalnemu indeksowi (booking_id, type, channel) tylko jedno
 * z równoległych wywołań wygra wstawienie — to eliminuje podwójną wysyłkę przy
 * wyścigu (np. strona rezerwacji + strona „sukces" odpalają powiadomienie razem).
 *
 * - `claimed`      → ten proces ma prawo wysłać (po wysyłce aktualizuje wiersz),
 * - `already_sent` → inny proces już wysłał (status `sent`) → pomijamy,
 * - `in_flight`    → inny proces właśnie wysyła (status `queued`) → pomijamy.
 *
 * Gdy istniejący wiersz ma status `failed`/`skipped`, przejmujemy go i ponawiamy.
 */
async function claimChannelSend(
  admin: NonNullable<ReturnType<typeof getServiceRoleClient>>,
  booking: BookingRow,
  channel: "email" | "sms",
  recipient: string,
): Promise<ClaimResult> {
  const ins = await admin.from("notification_logs").insert({
    business_id: booking.business_id,
    booking_id: booking.id,
    channel,
    type: "booking_created",
    status: "queued",
    recipient,
    subject: null,
    body: null,
    provider: null,
    provider_message_id: null,
    error_message: null,
    sent_at: null,
  })
  if (!ins.error) return "claimed"
  // 23505 = naruszenie unikalnego indeksu → wiersz już istnieje.
  if (ins.error.code !== "23505") {
    console.error("[booking-created.notify.log] claim_insert_failed", {
      code: ins.error.code,
      message: ins.error.message,
      booking_id: booking.id,
      channel,
    })
    // Wysyłamy mimo błędu logu — finalize/insert po wysyłce spróbuje zapisać ponownie.
    return "claimed"
  }

  const { data } = await admin
    .from("notification_logs")
    .select("status")
    .eq("booking_id", booking.id)
    .eq("type", "booking_created")
    .eq("channel", channel)
    .maybeSingle()
  const status = data?.status ?? ""
  if (status === "sent") return "already_sent"
  if (status === "queued") return "in_flight"

  await admin
    .from("notification_logs")
    .update({ status: "queued", error_message: null })
    .eq("booking_id", booking.id)
    .eq("type", "booking_created")
    .eq("channel", channel)
  return "claimed"
}

/** Aktualizuje zaklepany wiersz logu po próbie wysyłki (status końcowy). */
async function finalizeChannelLog(
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
  const { data, error } = await admin
    .from("notification_logs")
    .update({
      status: patch.status,
      subject: patch.subject,
      body: patch.body,
      provider: patch.provider ?? null,
      provider_message_id: patch.provider_message_id ?? null,
      error_message: patch.error_message ?? null,
      sent_at: patch.sent_at ?? null,
    })
    .eq("booking_id", booking.id)
    .eq("type", "booking_created")
    .eq("channel", channel)
    .select("id")
    .maybeSingle()
  if (error) {
    console.error("[booking-created.notify.log] finalize_failed", { channel, message: error.message })
    return
  }
  if (data?.id) return

  const inserted = await insertNotificationLog(
    admin,
    {
      business_id: booking.business_id,
      booking_id: booking.id,
      channel,
      type: "booking_created",
      recipient,
      status: patch.status,
      subject: patch.subject,
      body: patch.body,
      provider: patch.provider ?? null,
      provider_message_id: patch.provider_message_id ?? null,
      error_message: patch.error_message ?? null,
      sent_at: patch.sent_at ?? null,
    },
    "[booking-created.notify.log]",
  )
  if (!inserted.ok) {
    console.error("[booking-created.notify.log] finalize_insert_failed", {
      channel,
      message: inserted.message,
    })
  }
}

function mapLogRowStatus(status: string | null | undefined): BookingCreatedChannelStatus {
  if (status === "sent") return "sent"
  if (status === "failed") return "failed"
  if (status === "skipped") return "skipped"
  return "failed"
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
    .select("channel, status, error_message")
    .eq("booking_id", id)
    .eq("type", "booking_created")

  const emailRow = (logs ?? []).find((r) => r.channel === "email")
  const smsRow = (logs ?? []).find((r) => r.channel === "sms")

  return {
    ok: true,
    email: emailRow
      ? channelDetail(mapLogRowStatus(emailRow.status), {
          error_message: emailRow.error_message,
        })
      : channelDetail("missing"),
    sms: smsRow
      ? channelDetail(mapLogRowStatus(smsRow.status), {
          error_message: smsRow.error_message,
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

  let emailResult: BookingCreatedChannelDetail = channelDetail("missing")
  const email = booking.client_email ?? ""
  if (!wantEmail) {
    emailResult = channelDetail("skipped")
    if (email) {
      // Zapis „skipped" w historii — żeby było widać, że kanał jest wyłączony.
      await insertNotificationLog(
        admin,
        {
          business_id: booking.business_id,
          booking_id: booking.id,
          channel: "email",
          type: "booking_created",
          recipient: email,
          status: "skipped",
          subject: null,
          body: null,
          provider: null,
          provider_message_id: null,
          error: "channel_disabled",
          sent_at: null,
        },
        "[booking-created.notify.log]",
      )
    }
  } else if (!email) {
    emailResult = channelDetail("missing")
    await insertNotificationLog(
      admin,
      {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "email",
        type: "booking_created",
        recipient: "",
        status: "skipped",
        subject: null,
        body: null,
        provider: null,
        provider_message_id: null,
        error: "missing_email",
        sent_at: null,
      },
      "[booking-created.notify.log]",
    )
  } else {
    const claim = await claimChannelSend(admin, booking, "email", email)
    if (claim !== "claimed") {
      emailResult = channelDetail("already_sent")
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

        await finalizeChannelLog(admin, booking, "email", email, {
          status: logStatus,
          subject: messages.emailSubject,
          body: messages.emailText,
          provider: sent.ok ? sent.provider : null,
          provider_message_id: sent.ok ? sent.messageId ?? null : null,
          error_message: errorMessage,
          sent_at: sent.ok ? nowIso : null,
        })
        if (!sent.ok) {
          console.error("[booking-created.notify.email]", sent.code, sent.error ?? "")
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "unknown_error"
        console.error("[booking-created.notify.email]", errMsg)
        emailResult = channelDetail("failed", { error_message: errMsg })
        await finalizeChannelLog(admin, booking, "email", email, {
          status: "failed",
          subject: messages.emailSubject,
          body: messages.emailText,
          error_message: errMsg,
          sent_at: null,
        })
      }
    }
  }

  let smsResult: BookingCreatedChannelDetail = channelDetail("missing")
  const phone = booking.client_phone ?? ""
  const smsProvider = getActiveSmsReminderProvider()
  if (!wantSms) {
    smsResult = channelDetail("skipped")
    if (phone) {
      await insertNotificationLog(
        admin,
        {
          business_id: booking.business_id,
          booking_id: booking.id,
          channel: "sms",
          type: "booking_created",
          recipient: phone,
          status: "skipped",
          subject: null,
          body: null,
          provider: null,
          provider_message_id: null,
          error: "channel_disabled",
          sent_at: null,
        },
        "[booking-created.notify.log]",
      )
    }
  } else if (!phone) {
    smsResult = channelDetail("missing")
    await insertNotificationLog(
      admin,
      {
        business_id: booking.business_id,
        booking_id: booking.id,
        channel: "sms",
        type: "booking_created",
        recipient: "",
        status: "skipped",
        subject: null,
        body: null,
        provider: null,
        provider_message_id: null,
        error: "missing_phone",
        sent_at: null,
      },
      "[booking-created.notify.log]",
    )
  } else {
    const claim = await claimChannelSend(admin, booking, "sms", phone)
    if (claim !== "claimed") {
      smsResult = channelDetail("already_sent", { provider: smsProvider })
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

        await finalizeChannelLog(admin, booking, "sms", phone, {
          status: logStatus,
          subject: null,
          body: messages.sms,
          provider: sent.ok ? sent.provider : null,
          provider_message_id: sent.ok ? sent.messageId ?? null : null,
          error_message: errorMessage,
          sent_at: sent.ok ? nowIso : null,
        })
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
        await finalizeChannelLog(admin, booking, "sms", phone, {
          status: "failed",
          subject: null,
          body: messages.sms,
          error_message: errMsg,
          sent_at: null,
        })
      }
    }
  }

  // Własne szablony typu „zdarzenie" dla utworzenia rezerwacji (dedup chroni przed dublami).
  try {
    await dispatchCustomTemplatesForEvent({ bookingId: booking.id, eventKey: "created" })
  } catch {
    // brak wpływu na wynik wbudowanego potwierdzenia
  }

  return {
    ok: true,
    email: emailResult,
    sms: smsResult,
  }
}
