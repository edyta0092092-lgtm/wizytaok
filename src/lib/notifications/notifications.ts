import type { PublicBooking } from "@/lib/bookings/public-bookings"
import type {
  NotificationFailureReason,
  NotificationMessage,
  NotificationMessageType,
} from "@/types/domain"

export const NOTIFICATION_MESSAGES_STORAGE_KEY = "notification-messages"

// TODO: replace localStorage notification simulation with backend email/SMS provider and scheduled job.

function isNotificationMessageType(raw: unknown): raw is NotificationMessageType {
  return (
    raw === "booking_created" ||
    raw === "booking_confirmed" ||
    raw === "reminder_24h" ||
    raw === "first_reminder_24h" ||
    raw === "appointment_reminder_24h" ||
    raw === "second_reminder" ||
    raw === "appointment_reminder_short" ||
    raw === "manual_reminder"
  )
}

function coerceStoredNotificationType(raw: unknown): NotificationMessageType | null {
  if (typeof raw !== "string") return null
  if (
    raw === "business_reschedule_proposal" ||
    raw === "business_service_change_proposal" ||
    raw === "proposal_accepted"
  ) {
    return "manual_reminder"
  }
  return isNotificationMessageType(raw) ? raw : null
}

function normalizeMessage(raw: unknown): NotificationMessage | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Partial<NotificationMessage>
  if (
    typeof o.id !== "string" ||
    typeof o.bookingId !== "string" ||
    typeof o.businessSlug !== "string" ||
    (o.channel !== "sms" && o.channel !== "email") ||
    coerceStoredNotificationType(o.type) === null ||
    typeof o.recipientName !== "string" ||
    typeof o.body !== "string" ||
    typeof o.confirmationLink !== "string" ||
    (o.status !== "sent" &&
      o.status !== "simulated" &&
      o.status !== "scheduled" &&
      o.status !== "failed") ||
    typeof o.createdAt !== "string"
  ) {
    return null
  }
  const failureReason =
    o.failureReason === "missing_phone" || o.failureReason === "missing_email"
      ? o.failureReason
      : undefined
  return {
    id: o.id,
    bookingId: o.bookingId,
    businessSlug: o.businessSlug,
    channel: o.channel,
    type: coerceStoredNotificationType(o.type) ?? "manual_reminder",
    recipientName: o.recipientName,
    recipientPhone: typeof o.recipientPhone === "string" ? o.recipientPhone : undefined,
    recipientEmail: typeof o.recipientEmail === "string" ? o.recipientEmail : undefined,
    subject: typeof o.subject === "string" ? o.subject : undefined,
    body: o.body,
    confirmationLink: o.confirmationLink,
    status: o.status,
    failureReason,
    scheduledFor: typeof o.scheduledFor === "string" ? o.scheduledFor : undefined,
    sentAt: typeof o.sentAt === "string" ? o.sentAt : undefined,
    createdAt: o.createdAt,
  }
}

export function getNotificationMessages(): NotificationMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_MESSAGES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeMessage).filter((x): x is NotificationMessage => x !== null)
  } catch {
    return []
  }
}

export function notifyNotificationMessagesChanged(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("pw-notification-messages"))
}

function appendNotificationMessages(messages: NotificationMessage[]): void {
  const prev = getNotificationMessages()
  prev.push(...messages)
  window.localStorage.setItem(NOTIFICATION_MESSAGES_STORAGE_KEY, JSON.stringify(prev))
  notifyNotificationMessagesChanged()
}

export function saveNotificationMessage(message: NotificationMessage): void {
  if (typeof window === "undefined") return
  try {
    appendNotificationMessages([message])
  } catch {
    // noop
  }
}

/** Jedna operacja zapisu i jedno powiadomienie (np. para SMS + e-mail). */
export function saveNotificationMessagesBatch(messages: NotificationMessage[]): void {
  if (typeof window === "undefined" || messages.length === 0) return
  try {
    appendNotificationMessages(messages)
  } catch {
    // noop
  }
}

function formatDate(date: string, language: "pl" | "en"): string {
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

export function createBookingCreatedMessages(
  booking: PublicBooking,
  language: "pl" | "en"
): NotificationMessage[] {
  const createdAt = new Date().toISOString()
  const confirmPath = booking.confirmationToken ?? booking.id
  const confirmationLink = `/confirm/${confirmPath}`
  const dateLabel = formatDate(booking.date, language)
  const smsBody =
    language === "pl"
      ? `Cześć ${booking.customerName}, Twoja wizyta została potwierdzona: ${booking.serviceName}, ${dateLabel} o ${booking.time}. Zarządzaj wizytą lub anuluj ją tutaj: ${confirmationLink}`
      : `Hi ${booking.customerName}, your appointment is confirmed: ${booking.serviceName}, ${dateLabel} at ${booking.time}. Manage your appointment or cancel here: ${confirmationLink}`
  const emailSubject =
    language === "pl" ? "Wizyta potwierdzona" : "Appointment confirmed"
  const emailBody =
    language === "pl"
      ? `Cześć ${booking.customerName}, Twoja wizyta została zapisana i potwierdzona.\n\nUsługa: ${booking.serviceName}\nTermin: ${dateLabel} o ${booking.time}\n\nZarządzaj wizytą (sprawdź szczegóły lub anuluj wizytę):\n${confirmationLink}`
      : `Hi ${booking.customerName}, your appointment has been saved and confirmed.\n\nService: ${booking.serviceName}\nTime: ${dateLabel} at ${booking.time}\n\nManage your appointment (view details or cancel):\n${confirmationLink}`
  return [
    {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      businessSlug: booking.businessSlug,
      channel: "sms",
      type: "booking_created",
      recipientName: booking.customerName,
      recipientPhone: booking.customerPhone,
      body: smsBody,
      confirmationLink,
      status: "scheduled",
      createdAt,
    },
    {
      id: crypto.randomUUID(),
      bookingId: booking.id,
      businessSlug: booking.businessSlug,
      channel: "email",
      type: "booking_created",
      recipientName: booking.customerName,
      recipientEmail: booking.customerEmail,
      subject: emailSubject,
      body: emailBody,
      confirmationLink,
      status: "scheduled",
      createdAt,
    },
  ]
}

export function createBookingConfirmedMessages(
  booking: PublicBooking,
  language: "pl" | "en"
): NotificationMessage[] {
  const createdAt = new Date().toISOString()
  const confirmPath = booking.confirmationToken ?? booking.id
  const confirmationLink = `/confirm/${confirmPath}`
  const dateLabel = formatDate(booking.date, language)
  const hasPhone = Boolean(booking.customerPhone?.trim())
  const hasEmail = Boolean(booking.customerEmail?.trim())
  const smsBodySent =
    language === "pl"
      ? `Dziękujemy ${booking.customerName}. Twoja wizyta ${dateLabel} o ${booking.time} jest potwierdzona.`
      : `Thank you ${booking.customerName}. Your appointment on ${dateLabel} at ${booking.time} is confirmed.`
  const emailSubject =
    language === "pl" ? "Wizyta potwierdzona" : "Appointment confirmed"
  const emailBodySent =
    language === "pl"
      ? `Dziękujemy ${booking.customerName},\n\nTwoja wizyta jest potwierdzona.\n\nUsługa: ${booking.serviceName}\nTermin: ${dateLabel} o ${booking.time}\n\nZarządzaj wizytą (sprawdź szczegóły lub anuluj wizytę):\n${confirmationLink}`
      : `Thank you ${booking.customerName},\n\nyour appointment is confirmed.\n\nService: ${booking.serviceName}\nTime: ${dateLabel} at ${booking.time}\n\nManage your appointment (view details or cancel):\n${confirmationLink}`

  const sms: NotificationMessage = {
    id: crypto.randomUUID(),
    bookingId: booking.id,
    businessSlug: booking.businessSlug,
    channel: "sms",
    type: "booking_confirmed",
    recipientName: booking.customerName,
    recipientPhone: hasPhone ? booking.customerPhone : undefined,
    body: hasPhone ? smsBodySent : failedBody(language, "sms", "missing_phone"),
    confirmationLink,
    status: hasPhone ? "sent" : "failed",
    failureReason: hasPhone ? undefined : "missing_phone",
    sentAt: createdAt,
    createdAt,
  }

  const email: NotificationMessage = {
    id: crypto.randomUUID(),
    bookingId: booking.id,
    businessSlug: booking.businessSlug,
    channel: "email",
    type: "booking_confirmed",
    recipientName: booking.customerName,
    recipientEmail: hasEmail ? booking.customerEmail : undefined,
    subject: emailSubject,
    body: hasEmail ? emailBodySent : failedBody(language, "email", "missing_email"),
    confirmationLink,
    status: hasEmail ? "sent" : "failed",
    failureReason: hasEmail ? undefined : "missing_email",
    sentAt: createdAt,
    createdAt,
  }

  return [sms, email]
}

export function enqueueBookingConfirmedNotifications(
  booking: PublicBooking,
  language: "pl" | "en"
): ProposalChannelOutcome {
  const messages = createBookingConfirmedMessages(booking, language)
  saveNotificationMessagesBatch(messages)
  return getProposalChannelOutcome(messages)
}

function failedBody(
  language: "pl" | "en",
  channel: "sms" | "email",
  reason: NotificationFailureReason
): string {
  if (language === "pl") {
    if (channel === "sms" && reason === "missing_phone") {
      return "Nie wysłano SMS - brak numeru telefonu klienta."
    }
    return "Nie wysłano e-maila - brak adresu e-mail klienta."
  }
  if (channel === "sms" && reason === "missing_phone") {
    return "SMS not sent - missing client phone."
  }
  return "Email not sent - missing client email."
}

export type ProposalChannelOutcome = "sms_and_email" | "sms_only" | "email_only" | "none"

export function getProposalChannelOutcome(messages: NotificationMessage[]): ProposalChannelOutcome {
  const sms = messages.find((m) => m.channel === "sms")
  const email = messages.find((m) => m.channel === "email")
  const channelOk = (m: NotificationMessage | undefined) =>
    m?.status === "sent" || m?.status === "simulated"
  const smsOk = channelOk(sms)
  const emailOk = channelOk(email)
  if (smsOk && emailOk) return "sms_and_email"
  if (smsOk) return "sms_only"
  if (emailOk) return "email_only"
  return "none"
}

export function getMessagesForBooking(bookingId: string): NotificationMessage[] {
  return getNotificationMessages().filter((m) => m.bookingId === bookingId)
}
