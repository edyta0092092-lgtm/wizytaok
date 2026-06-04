import type { SupabaseClient } from "@supabase/supabase-js"

import { buildBusinessTemplateVars } from "@/lib/notifications/business-template-vars"
import { getPublicAppOrigin } from "@/lib/notifications/public-app-origin"
import { applyTemplateVariables, getTemplateRuntime } from "@/lib/notifications/template-runtime"
import { getStaffDisplayName, getStaffFirstName } from "@/lib/staff/staff-display"
import type { Database, Tables } from "@/types/database"

type Sb = SupabaseClient<Database>

export type PreviewBookingContext = {
  id: string
  clientName: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  status: string
  createdAt: string | null
  confirmedAt: string | null
  updatedAt: string | null
  lastStatusChangeSource: string | null
  confirmationToken: string | null
  staffName: string | null
}

export type PreviewBusinessContext = {
  business_name: string | null
  slug: string | null
  phone: string | null
  contact_phone: string | null
  business_address: string | null
}

export type PreviewQueueRow = {
  appointment_id: string
  channel: string
  reminder_kind: string
  status: string
  scheduled_for: string
  sent_at?: string | null
  created_at?: string | null
}

export type NotificationPreviewTarget =
  | { kind: "db"; row: Tables<"notification_logs"> }
  | {
      kind: "planned"
      row: PlannedReminderPreviewRow
      channel: "sms" | "email"
      reminderType: "reminder_24h" | "reminder_before_visit"
    }
  | {
      kind: "reminderOutcome"
      row: PlannedReminderPreviewRow
      channel: "sms" | "email"
      reminderType: "reminder_24h" | "reminder_before_visit"
      outcomeStatus: string
    }
  | { kind: "local"; msg: { channel: "sms" | "email"; type?: string; body?: string; subject?: string; createdAt?: string; sentAt?: string; scheduledFor?: string } }

export type PlannedReminderPreviewRow = {
  id: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  appointment_date: string
  appointment_time: string
  first_reminder_due_at: string | null
  first_reminder_sent_at: string | null
  first_reminder_status: string | null
  second_reminder_due_at: string | null
  second_reminder_sent_at: string | null
  second_reminder_status: string | null
}

export type NotificationPreviewDetails = {
  body: string | null
  subject: string | null
  createdAtIso: string | null
  sentAtLabel: string
}

function canonicalNotificationType(raw: string): string {
  const type = raw.trim()
  if (!type) return ""
  if (["reminder_24h", "first_reminder_24h", "appointment_reminder_24h", "reminder"].includes(type)) {
    return "reminder_24h"
  }
  if (["reminder_before_visit", "second_reminder", "appointment_reminder_short"].includes(type)) {
    return "reminder_before_visit"
  }
  if (["booking_confirmation", "booking_confirmed", "booking_created", "confirmation"].includes(type)) {
    return "booking_confirmation"
  }
  if (
    [
      "booking_cancelled_by_company",
      "company_cancelled_booking",
      "booking_cancelled_by_client",
      "client_cancelled_booking",
    ].includes(type)
  ) {
    return "booking_cancelled_by_company"
  }
  if (["no_show_follow_up", "followup_noshow", "follow_up_no_show"].includes(type)) {
    return "no_show_follow_up"
  }
  if (["thank_you_after_visit", "thank_you", "visit_thank_you"].includes(type)) {
    return "thank_you_after_visit"
  }
  return type
}

function formatTimeHm(raw: string): string {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

function queueLookupKey(
  appointmentId: string,
  reminderType: "reminder_24h" | "reminder_before_visit",
  channel: "sms" | "email",
): string {
  const kind = reminderType === "reminder_24h" ? "first" : "second"
  return `${appointmentId}:${kind}:${channel}`
}

function plannedAtIso(
  entry: {
    row: PlannedReminderPreviewRow
    reminderType: "reminder_24h" | "reminder_before_visit"
    channel?: "sms" | "email"
  },
  queueByKey?: Map<string, PreviewQueueRow>,
): string | null {
  if (entry.channel && queueByKey) {
    const scheduled = queueByKey.get(queueLookupKey(entry.row.id, entry.reminderType, entry.channel))
      ?.scheduled_for
    if (scheduled?.trim()) return scheduled
  }
  if (entry.reminderType === "reminder_24h") {
    return entry.row.first_reminder_due_at?.trim() || null
  }
  return entry.row.second_reminder_due_at?.trim() || null
}

function bookingContextFromPlannedRow(
  row: PlannedReminderPreviewRow,
  partial?: Partial<PreviewBookingContext>,
): PreviewBookingContext {
  return {
    id: row.id,
    clientName: row.client_name?.trim() || partial?.clientName || "",
    serviceName: partial?.serviceName ?? "",
    appointmentDate: String(row.appointment_date ?? partial?.appointmentDate ?? "").slice(0, 10),
    appointmentTime: String(row.appointment_time ?? partial?.appointmentTime ?? "").slice(0, 5),
    status: partial?.status ?? "confirmed",
    createdAt: partial?.createdAt ?? null,
    confirmedAt: partial?.confirmedAt ?? null,
    updatedAt: partial?.updatedAt ?? null,
    lastStatusChangeSource: partial?.lastStatusChangeSource ?? null,
    confirmationToken: partial?.confirmationToken ?? null,
    staffName: partial?.staffName ?? null,
  }
}

function resolvePreviewBooking(
  target: NotificationPreviewTarget,
  booking: PreviewBookingContext | null,
): PreviewBookingContext | null {
  if (booking) return booking
  if (target.kind === "planned" || target.kind === "reminderOutcome") {
    return bookingContextFromPlannedRow(target.row)
  }
  return null
}

function queueCreatedAtIso(
  target: NotificationPreviewTarget,
  queueByKey: Map<string, PreviewQueueRow>,
): string | null {
  if (target.kind !== "planned" && target.kind !== "reminderOutcome") return null
  return (
    queueByKey.get(queueLookupKey(target.row.id, target.reminderType, target.channel))?.created_at?.trim() ||
    null
  )
}

function bookingConfirmedAtIso(booking: PreviewBookingContext | null): string | null {
  if (!booking) return null
  if (booking.confirmedAt?.trim()) return booking.confirmedAt
  if (
    booking.status.trim().toLowerCase() === "confirmed" &&
    booking.lastStatusChangeSource?.trim().toLowerCase() === "confirm" &&
    booking.updatedAt?.trim()
  ) {
    return booking.updatedAt
  }
  if (booking.createdAt?.trim()) return booking.createdAt
  return null
}

function isPendingLikeStatus(status: string): boolean {
  const s = status.trim().toLowerCase()
  return s === "pending" || s === "queued" || s === "scheduled"
}

function dbChannel(row: Tables<"notification_logs">): "sms" | "email" {
  return String(row.channel ?? "").trim().toLowerCase() === "email" ? "email" : "sms"
}

function templateTypeForPreview(target: NotificationPreviewTarget): string {
  if (target.kind === "planned" || target.kind === "reminderOutcome") {
    return target.reminderType
  }
  if (target.kind === "db") {
    return canonicalNotificationType(String(target.row.type ?? ""))
  }
  return canonicalNotificationType(String(target.msg.type ?? ""))
}

function previewChannel(target: NotificationPreviewTarget): "sms" | "email" {
  if (target.kind === "db") return dbChannel(target.row)
  if (target.kind === "planned" || target.kind === "reminderOutcome") return target.channel
  return target.msg.channel
}

function fallbackReminderSms(
  reminderType: "reminder_24h" | "reminder_before_visit",
  vars: Record<string, string>,
): string {
  if (reminderType === "reminder_before_visit") {
    return `Cześć ${vars.imie}, przypominamy o dzisiejszej wizycie o ${vars.godzina} (${vars.usluga}). Adres: ${vars.adres_firmy}. Do zobaczenia!`
  }
  return `Cześć ${vars.imie}, przypominamy o Twojej wizycie jutro o ${vars.godzina} (${vars.usluga}). Adres: ${vars.adres_firmy}. Zarządzaj wizytą: ${vars.link_potwierdzenia}`
}

function fallbackBookingConfirmationSms(vars: Record<string, string>): string {
  return `Wizyta potwierdzona: ${vars.usluga}, ${vars.data} o ${vars.godzina}. Zarządzaj wizytą: ${vars.link_potwierdzenia}`
}

function buildTemplateVars(args: {
  booking: PreviewBookingContext
  business: PreviewBusinessContext | null
  language: "pl" | "en"
}): Record<string, string> {
  const { booking, business, language } = args
  const origin = getPublicAppOrigin()
  const token = booking.confirmationToken?.trim() ?? ""
  const confirmUrl = token
    ? `${origin}/confirm/${encodeURIComponent(token)}?source=reminder`
    : ""
  const dateLabel = booking.appointmentDate.slice(0, 10)
  const timeHm = formatTimeHm(booking.appointmentTime)
  const staffDisplayName = getStaffDisplayName({ name: booking.staffName ?? "" })
  const staffFirstName = getStaffFirstName({ name: booking.staffName ?? "" })

  return {
    imie: booking.clientName.split(/\s+/)[0] || booking.clientName,
    data: dateLabel,
    godzina: timeHm,
    usluga: booking.serviceName,
    osoba: staffDisplayName,
    imie_osoby: staffFirstName,
    ...buildBusinessTemplateVars(business, {
      link_potwierdzenia: confirmUrl,
      link_anulowania: confirmUrl,
    }),
    ...(language === "en" ? {} : {}),
  }
}

async function renderPreviewMessage(args: {
  client: Sb
  businessId: string
  target: NotificationPreviewTarget
  booking: PreviewBookingContext | null
  business: PreviewBusinessContext | null
  language: "pl" | "en"
}): Promise<{ body: string | null; subject: string | null }> {
  const { client, businessId, target, business, language } = args
  const booking = resolvePreviewBooking(target, args.booking)
  const channel = previewChannel(target)

  if (target.kind === "local") {
    return {
      body: target.msg.body?.trim() || null,
      subject: target.msg.subject?.trim() || null,
    }
  }

  if (target.kind === "db") {
    const savedBody = target.row.body?.trim()
    const savedSubject = target.row.subject?.trim()
    if (savedBody) {
      return { body: savedBody, subject: savedSubject || null }
    }
  }

  if (!booking) {
    return { body: null, subject: null }
  }

  const templateType = templateTypeForPreview(target)
  const runtime = await getTemplateRuntime(client, businessId, templateType)
  const vars = buildTemplateVars({ booking, business, language })

  if (channel === "email") {
    const subject =
      runtime.emailSubject && runtime.emailSubject.trim().length > 0
        ? applyTemplateVariables(runtime.emailSubject, vars)
        : templateType === "booking_confirmation"
          ? language === "en"
            ? "Appointment confirmed"
            : "Wizyta potwierdzona"
          : language === "en"
            ? "Appointment reminder"
            : "Przypomnienie o wizycie"
    const body =
      runtime.emailBody && runtime.emailBody.trim().length > 0
        ? applyTemplateVariables(runtime.emailBody, vars)
        : templateType === "reminder_24h" || templateType === "reminder_before_visit"
          ? applyTemplateVariables(
              language === "en"
                ? "Hello {{imie}}, this is a reminder about your appointment on {{data}} at {{godzina}} ({{usluga}})."
                : "Cześć {{imie}}, przypominamy o wizycie {{data}} o {{godzina}} ({{usluga}}).",
              vars,
            )
          : templateType === "booking_confirmation"
            ? applyTemplateVariables(
                language === "en"
                  ? "Appointment confirmed: {{usluga}}, {{data}} at {{godzina}}."
                  : "Wizyta potwierdzona: {{usluga}}, {{data}} o {{godzina}}.",
                vars,
              )
            : null
    return { body, subject }
  }

  const smsBody =
    runtime.smsBody && runtime.smsBody.trim().length > 0
      ? applyTemplateVariables(runtime.smsBody, vars)
      : templateType === "booking_confirmation"
        ? fallbackBookingConfirmationSms(vars)
        : templateType === "reminder_24h" || templateType === "reminder_before_visit"
          ? fallbackReminderSms(templateType, vars)
          : null

  return { body: smsBody, subject: null }
}

function actualSentAtIso(
  target: NotificationPreviewTarget,
  queueByKey: Map<string, PreviewQueueRow>,
): string | null {
  if (target.kind === "db") {
    if (target.row.sent_at?.trim()) return target.row.sent_at
    return null
  }
  if (target.kind === "local") {
    return target.msg.sentAt?.trim() || null
  }
  const sentAt =
    target.reminderType === "reminder_24h"
      ? target.row.first_reminder_sent_at
      : target.row.second_reminder_sent_at
  if (sentAt?.trim()) return sentAt

  const queueRow = queueByKey.get(
    queueLookupKey(target.row.id, target.reminderType, target.channel),
  )
  if (queueRow?.status.trim().toLowerCase() === "sent" && queueRow.sent_at?.trim()) {
    return queueRow.sent_at
  }
  return null
}

function previewStatus(target: NotificationPreviewTarget): string {
  if (target.kind === "db") return String(target.row.status ?? "").trim().toLowerCase()
  if (target.kind === "local") return String(target.msg.sentAt ? "sent" : "scheduled").toLowerCase()
  if (target.kind === "reminderOutcome") {
    return String(target.outcomeStatus ?? "").trim().toLowerCase() || "sent"
  }
  return "scheduled"
}

function scheduledAtIso(
  target: NotificationPreviewTarget,
  queueByKey: Map<string, PreviewQueueRow>,
): string | null {
  if (target.kind === "planned" || target.kind === "reminderOutcome") {
    return plannedAtIso(target, queueByKey)
  }
  if (target.kind === "local") {
    return target.msg.scheduledFor?.trim() || null
  }
  if (target.kind === "db") {
    const bookingId = target.row.booking_id?.trim()
    if (!bookingId) return null
    const type = canonicalNotificationType(String(target.row.type ?? ""))
    if (type !== "reminder_24h" && type !== "reminder_before_visit") return null
    const channel = dbChannel(target.row)
    return queueByKey.get(queueLookupKey(bookingId, type, channel))?.scheduled_for?.trim() || null
  }
  return null
}

export async function loadNotificationPreviewDetails(args: {
  client: Sb
  businessId: string
  target: NotificationPreviewTarget
  booking: PreviewBookingContext | null
  business: PreviewBusinessContext | null
  queueByKey: Map<string, PreviewQueueRow>
  language: "pl" | "en"
  formatDateTime: (raw: string | null | undefined) => string
  scheduledSendLabel: (dateTime: string) => string
}): Promise<NotificationPreviewDetails> {
  const { client, businessId, target, booking, business, queueByKey, formatDateTime, scheduledSendLabel } =
    args

  const effectiveBooking = resolvePreviewBooking(target, booking)

  const message = await renderPreviewMessage({
    client,
    businessId,
    target,
    booking: effectiveBooking,
    business,
    language: args.language,
  })

  const createdAtIso =
    bookingConfirmedAtIso(effectiveBooking) ??
    queueCreatedAtIso(target, queueByKey) ??
    (target.kind === "db" ? target.row.created_at : null) ??
    (target.kind === "local" ? target.msg.createdAt ?? null : null)

  const sentIso = actualSentAtIso(target, queueByKey)
  const status = previewStatus(target)
  let sentAtLabel = "-"

  if (sentIso) {
    sentAtLabel = formatDateTime(sentIso)
  } else if (isPendingLikeStatus(status) || target.kind === "planned") {
    const scheduledIso = scheduledAtIso(target, queueByKey)
    if (scheduledIso) {
      sentAtLabel = scheduledSendLabel(formatDateTime(scheduledIso))
    }
  }

  return {
    body: message.body,
    subject: message.subject,
    createdAtIso,
    sentAtLabel,
  }
}
