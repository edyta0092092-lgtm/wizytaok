import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { formatPolishAppointmentLabel } from "@/lib/notifications/appointment-reminder-email"
import { sendReminderEmail } from "@/lib/notifications/email"
import { plainTextEmailToHtml } from "@/lib/notifications/plain-text-email-html"
import { applyTemplateVariables } from "@/lib/notifications/template-runtime"
import { getSmsQuotaStatus } from "@/lib/notifications/sms-monthly-limit"
import { sendPlainTransactionalSms } from "@/lib/notifications/transactional-sms"
import { getStaffDisplayName } from "@/lib/staff/staff-display"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database"

type Admin = SupabaseClient<Database>

export type CustomTemplateRow = Tables<"custom_templates">

export type CustomTemplateBookingRow = {
  id: string
  business_id: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  service_name: string | null
  appointment_date: string
  appointment_time: string
  staff_name: string | null
  confirmation_token: string | null
}

export type CustomTemplateBusinessRow = Pick<
  Tables<"business_profiles">,
  "id" | "slug" | "phone" | "contact_phone" | "business_name" | "business_address"
>

export type CustomTemplateChannel = "email" | "sms"

export type CustomChannelOutcome = {
  channel: CustomTemplateChannel
  status: "sent" | "failed" | "skipped"
  error?: string
}

function getPublicAppOrigin(): string {
  const explicit = process.env.APP_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`
  return "http://localhost:3000"
}

/** Zmienne podstawiane w treści ({{imie}}, {{data}}, {{godzina}}, {{usluga}}, linki firmowe…). */
export function buildCustomTemplateVars(
  booking: CustomTemplateBookingRow,
  business: CustomTemplateBusinessRow,
): Record<string, string> {
  const { dateLabel, timeLabel } = formatPolishAppointmentLabel(
    booking.appointment_date,
    booking.appointment_time,
  )
  const clientName = (booking.client_name ?? "").trim()
  const token = (booking.confirmation_token ?? "").trim()
  const origin = getPublicAppOrigin()
  const confirmUrl = token ? `${origin}/confirm/${encodeURIComponent(token)}` : ""
  return {
    imie: clientName.split(/\s+/)[0] || clientName,
    data: dateLabel,
    godzina: timeLabel,
    usluga: (booking.service_name ?? "").trim(),
    osoba: getStaffDisplayName({ name: booking.staff_name ?? "" }),
    ...buildBusinessTemplateVars(business, {
      link_potwierdzenia: confirmUrl,
      link_anulowania: confirmUrl,
    }),
  }
}

export type RenderedCustomTemplate = {
  smsBody: string
  emailSubject: string
  emailText: string
  emailHtml: string
}

export function renderCustomTemplate(
  template: CustomTemplateRow,
  vars: Record<string, string>,
): RenderedCustomTemplate {
  const emailText = applyTemplateVariables(template.email_content ?? "", vars)
  return {
    smsBody: applyTemplateVariables(template.sms_content ?? "", vars),
    emailSubject: applyTemplateVariables(template.email_subject ?? "", vars),
    emailText,
    emailHtml: plainTextEmailToHtml(emailText),
  }
}

/** Kanały do wysłania = włączone w szablonie i z obecnym kontaktem klienta. */
export function resolveChannels(
  template: CustomTemplateRow,
  booking: CustomTemplateBookingRow,
): Array<{ channel: CustomTemplateChannel; recipient: string }> {
  const out: Array<{ channel: CustomTemplateChannel; recipient: string }> = []
  const email = (booking.client_email ?? "").trim()
  const phone = (booking.client_phone ?? "").trim()
  if (template.email_enabled && email) out.push({ channel: "email", recipient: email })
  if (template.sms_enabled && phone) out.push({ channel: "sms", recipient: phone })
  return out
}

type DeliverResult =
  | { ok: true; provider: string; messageId: string | null }
  | { ok: false; error: string }

async function deliverChannel(
  channel: CustomTemplateChannel,
  recipient: string,
  rendered: RenderedCustomTemplate,
): Promise<DeliverResult> {
  if (channel === "email") {
    const res = await sendReminderEmail({
      to: recipient,
      subject: rendered.emailSubject.trim() || "Wiadomość",
      textBody: rendered.emailText,
      htmlBody: rendered.emailHtml,
    })
    return res.ok
      ? { ok: true, provider: "resend", messageId: res.messageId ?? null }
      : { ok: false, error: `${res.code}${res.error ? `: ${res.error}` : ""}` }
  }
  const res = await sendPlainTransactionalSms({ to: recipient, body: rendered.smsBody })
  return res.ok
    ? { ok: true, provider: res.provider, messageId: res.messageId ?? null }
    : { ok: false, error: `${res.code}${res.error ? `: ${res.error}` : ""}` }
}

/**
 * Próba „zaklepania" wysyłki (idempotencja). Wstawia rekord od razu jako `processing`.
 * Zwraca "claimed", jeśli to my mamy wysłać; "skip", jeśli już wysłane/w toku.
 */
async function claimSend(
  admin: Admin,
  key: {
    businessId: string
    appointmentId: string
    templateId: string
    channel: CustomTemplateChannel
    recipient: string
  },
): Promise<"claimed" | "skip"> {
  const nowIso = new Date().toISOString()
  const insert = await admin
    .from("custom_template_sends")
    .insert({
      business_id: key.businessId,
      appointment_id: key.appointmentId,
      custom_template_id: key.templateId,
      channel: key.channel,
      status: "processing",
      locked_at: nowIso,
      recipient: key.recipient,
    } as never)
    .select("id")
  if (!insert.error) return "claimed"
  if (insert.error.code !== "23505") {
    // Inny błąd zapisu — nie wysyłamy, żeby uniknąć wysyłek bez śladu.
    return "skip"
  }
  // Rekord istnieje — re-claim tylko, jeśli nie jest sent/processing.
  const existing = await admin
    .from("custom_template_sends")
    .select("id,status")
    .eq("appointment_id", key.appointmentId)
    .eq("custom_template_id", key.templateId)
    .eq("channel", key.channel)
    .maybeSingle()
  const row = existing.data as { id: string; status: string } | null
  if (!row) return "skip"
  if (row.status === "sent" || row.status === "processing") return "skip"
  const reclaim = await admin
    .from("custom_template_sends")
    .update({ status: "processing", locked_at: nowIso } as never)
    .eq("id", row.id)
    .in("status", ["pending", "failed", "skipped"])
    .select("id")
  return reclaim.data && reclaim.data.length > 0 ? "claimed" : "skip"
}

/** Treść zapisywana w logu wysyłki dla danego kanału (do podglądu w historii). */
function channelContent(
  channel: CustomTemplateChannel,
  rendered: RenderedCustomTemplate,
): { subject: string | null; body: string } {
  return channel === "email"
    ? { subject: rendered.emailSubject.trim() || null, body: rendered.emailText }
    : { subject: null, body: rendered.smsBody }
}

async function finalizeSend(
  admin: Admin,
  key: { appointmentId: string; templateId: string; channel: CustomTemplateChannel },
  result: {
    status: "sent" | "failed" | "skipped" | "pending"
    provider?: string | null
    messageId?: string | null
    error?: string | null
    subject?: string | null
    body?: string | null
  },
): Promise<void> {
  const nowIso = new Date().toISOString()
  await admin
    .from("custom_template_sends")
    .update({
      status: result.status,
      sent_at: result.status === "sent" ? nowIso : null,
      failed_at: result.status === "failed" ? nowIso : null,
      skipped_at: result.status === "skipped" ? nowIso : null,
      provider: result.provider ?? null,
      provider_message_id: result.messageId ?? null,
      last_error: result.error ?? null,
      subject: result.subject ?? null,
      body: result.body ?? null,
      locked_at: null,
    } as never)
    .eq("appointment_id", key.appointmentId)
    .eq("custom_template_id", key.templateId)
    .eq("channel", key.channel)
}

/**
 * Wysyła własny szablon dla wizyty z deduplikacją (zaplanowane / zdarzenia).
 * Każda para (wizyta, szablon, kanał) wyśle się maksymalnie raz.
 */
export async function sendCustomTemplateForBookingDedup(
  admin: Admin,
  args: {
    template: CustomTemplateRow
    booking: CustomTemplateBookingRow
    business: CustomTemplateBusinessRow
  },
): Promise<CustomChannelOutcome[]> {
  const { template, booking, business } = args
  const channels = resolveChannels(template, booking)
  if (channels.length === 0) return []
  const vars = buildCustomTemplateVars(booking, business)
  const rendered = renderCustomTemplate(template, vars)
  const outcomes: CustomChannelOutcome[] = []
  for (const { channel, recipient } of channels) {
    const claim = await claimSend(admin, {
      businessId: booking.business_id,
      appointmentId: booking.id,
      templateId: template.id,
      channel,
      recipient,
    })
    if (claim === "skip") {
      outcomes.push({ channel, status: "skipped" })
      continue
    }
    // Wspólny miesięczny limit SMS (przypomnienia + własne szablony).
    if (channel === "sms") {
      const quota = await getSmsQuotaStatus(admin, booking.business_id)
      if (quota.countFailed) {
        // Nie potrafimy policzyć — zwalniamy rekord do ponownej próby w kolejnym przebiegu.
        await finalizeSend(admin, { appointmentId: booking.id, templateId: template.id, channel }, {
          status: "pending",
          error: "sms_quota_count_failed",
        })
        outcomes.push({ channel, status: "skipped", error: "sms_quota_count_failed" })
        continue
      }
      if (!quota.allowed) {
        await finalizeSend(admin, { appointmentId: booking.id, templateId: template.id, channel }, {
          status: "skipped",
          error: "sms_monthly_limit_reached",
          ...channelContent(channel, rendered),
        })
        outcomes.push({ channel, status: "skipped", error: "sms_monthly_limit_reached" })
        continue
      }
    }
    const content = channelContent(channel, rendered)
    const delivered = await deliverChannel(channel, recipient, rendered)
    if (delivered.ok) {
      await finalizeSend(admin, { appointmentId: booking.id, templateId: template.id, channel }, {
        status: "sent",
        provider: delivered.provider,
        messageId: delivered.messageId,
        ...content,
      })
      outcomes.push({ channel, status: "sent" })
    } else {
      await finalizeSend(admin, { appointmentId: booking.id, templateId: template.id, channel }, {
        status: "failed",
        error: delivered.error,
        ...content,
      })
      outcomes.push({ channel, status: "failed", error: delivered.error })
    }
  }
  return outcomes
}

/**
 * Ręczna wysyłka „wyślij teraz" — może być powtarzana (upsert logu, bez blokady idempotencji).
 */
export async function sendCustomTemplateManual(
  admin: Admin,
  args: {
    template: CustomTemplateRow
    booking: CustomTemplateBookingRow
    business: CustomTemplateBusinessRow
  },
): Promise<CustomChannelOutcome[]> {
  const { template, booking, business } = args
  const channels = resolveChannels(template, booking)
  if (channels.length === 0) return []
  const vars = buildCustomTemplateVars(booking, business)
  const rendered = renderCustomTemplate(template, vars)
  const nowIso = new Date().toISOString()
  const outcomes: CustomChannelOutcome[] = []
  for (const { channel, recipient } of channels) {
    if (channel === "sms") {
      const quota = await getSmsQuotaStatus(admin, booking.business_id)
      if (quota.countFailed || !quota.allowed) {
        const reason = quota.countFailed ? "sms_quota_count_failed" : "sms_monthly_limit_reached"
        const content = channelContent(channel, rendered)
        await admin.from("custom_template_sends").upsert(
          {
            business_id: booking.business_id,
            appointment_id: booking.id,
            custom_template_id: template.id,
            channel,
            status: "skipped",
            recipient,
            subject: content.subject,
            body: content.body,
            skipped_at: nowIso,
            last_error: reason,
            locked_at: null,
          } as never,
          { onConflict: "appointment_id,custom_template_id,channel" },
        )
        outcomes.push({ channel, status: "skipped", error: reason })
        continue
      }
    }
    const content = channelContent(channel, rendered)
    const delivered = await deliverChannel(channel, recipient, rendered)
    await admin
      .from("custom_template_sends")
      .upsert(
        {
          business_id: booking.business_id,
          appointment_id: booking.id,
          custom_template_id: template.id,
          channel,
          status: delivered.ok ? "sent" : "failed",
          recipient,
          subject: content.subject,
          body: content.body,
          sent_at: delivered.ok ? nowIso : null,
          failed_at: delivered.ok ? null : nowIso,
          provider: delivered.ok ? delivered.provider : null,
          provider_message_id: delivered.ok ? delivered.messageId : null,
          last_error: delivered.ok ? null : delivered.error,
          locked_at: null,
        } as never,
        { onConflict: "appointment_id,custom_template_id,channel" },
      )
    outcomes.push(
      delivered.ok
        ? { channel, status: "sent" }
        : { channel, status: "failed", error: delivered.error },
    )
  }
  return outcomes
}
