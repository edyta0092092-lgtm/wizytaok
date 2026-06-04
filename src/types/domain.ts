export type AppointmentStatus =
  | "booked"
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show"

export type NoShowRisk = "none" | "low" | "medium" | "high"

/** Skąd pochodzi wizyta (kolumna bookings.source). */
export type BookingSource = "online" | "manual" | "manual_admin" | "manual_staff"

export type Appointment = {
  id: string
  clientName: string
  phone: string
  email?: string
  serviceLabel: string
  startsAt: string
  /** ISO czasu utworzenia rezerwacji (kiedy klient dokonał rezerwacji). */
  createdAt?: string
  status: AppointmentStatus
  notes?: string
  /** Prośba o zmiana terminu z publicznego linku potwierdzenia (MVP localStorage). */
  rescheduleMessage?: string
  proposedDate?: string
  proposedTime?: string
  proposedServiceName?: string
  proposedServiceDuration?: number
  proposedServicePrice?: number
  /** Legacy Supabase column; not used in UI. */
  proposedStaffId?: string
  proposedStaffName?: string
  customerNote?: string
  businessNote?: string
  internalNote?: string
  /** Supabase: zaplanowany czas wysłania przypomnienia (ISO). */
  reminderDueAt?: string | null
  /** Supabase: czas wysłania lub zapisu symulacji przypomnienia (ISO). */
  reminderSentAt?: string | null
  /** Supabase: pending / sent / simulated itd. */
  reminderStatus?: string | null
  /** Supabase: błąd techniczny przy przypomnieniu. */
  reminderError?: string | null
  firstReminderDueAt?: string | null
  firstReminderSentAt?: string | null
  firstReminderStatus?: string | null
  secondReminderDueAt?: string | null
  secondReminderSentAt?: string | null
  secondReminderStatus?: string | null
  secondReminderError?: string | null
  lastUpdatedBy?: "customer" | "business" | "system"
  lastStatusChangeAt?: string
  lastStatusChangeSource?:
    | "manual"
    | "confirm"
    | "cancel"
    | "system"
    | "auto_reminder_24h"
    | "automatic_24h_reminder"
  statusBeforeRequest?: "booked" | "confirmed"
  /** Termin przed propozycją firmy (MVP localStorage). */
  previousDate?: string
  previousTime?: string
  /** Usługa sprzed zmiany po zaakceptowanej propozycji firmy. */
  previousServiceName?: string
  previousServiceDuration?: number
  previousServicePrice?: number
  /** Ostatnio zaakceptowana zmiana z public booking (wizualizacja historii na /confirm). */
  lastChangeType?:
    | "business_proposal_accepted"
    | "customer_request_accepted"
    | "customer_service_request_accepted"
    | "customer_request_rejected"
    | "reminder_24h_sent"
  acceptedProposalAt?: string
  businessProposalKind?: "time" | "service" | "both"
  noShowRisk?: NoShowRisk
  /** Skąd rekord dla MVP (demo mock może być bez źródła). */
  source?: BookingSource
  /** Supabase: token potwierdzenia dla /confirm. */
  confirmationToken?: string
  /** Supabase: slug firmy dla kontekstu. */
  businessSlug?: string
  /** Supabase: powiązanie z tabelą clients. */
  clientId?: string | null
  /** Supabase: id usługi z bookings.service_id (do wyboru pracownika). */
  serviceId?: string
  staffId?: string
  staffName?: string
}

export type DashboardMetrics = {
  visitsToday: number
  visitsTomorrow: number
  confirmedCount: number
  potentialNoShows: number
}

/** Poziom ryzyka nieobecności klienta (etykieta w UI) */
export type ClientRiskTier = "low" | "medium" | "high"

export type ClientVisitHistoryItem = {
  id: string
  appointmentId?: string
  startsAt: string
  serviceLabel: string
  status: AppointmentStatus
  notes?: string
}

export type ClientAttachment = {
  id: string
  name: string
  mimeType: string
  size: number
  dataUrl: string
  createdAt: string
}

export type Client = {
  id: string
  fullName: string
  phone: string
  email: string
  visitCount: number
  confirmedVisitCount: number
  noShowCount: number
  cancelledVisitCount: number
  notes?: string
  attachments?: ClientAttachment[]
  /** 0–100, im wyżej tym większe ryzyko nieobecności klienta */
  riskScore: number
  riskTier: ClientRiskTier
  visitHistory: ClientVisitHistoryItem[]
}

export type MessageTemplateType =
  | "reminder_24h"
  | "reminder_before_visit"
  | "booking_confirmation"
  | "booking_cancelled_by_client"
  | "no_show_follow_up"
  | "reminder"
  | "second_reminder"
  | "confirmation"
  | "followup_noshow"
  | "booking_cancelled_by_company"
  | "thank_you_after_visit"

export type MessageTemplateChannel = "sms" | "email"

export type MessageTemplateStatus = "active" | "draft"

export type MessageTemplate = {
  id: string
  title: string
  type: MessageTemplateType
  channel: MessageTemplateChannel
  body: string
  status: MessageTemplateStatus
}

export type NotificationMessageType =
  | "booking_created"
  | "booking_confirmed"
  | "thank_you_after_visit"
  | "reminder_24h"
  | "first_reminder_24h"
  | "appointment_reminder_24h"
  | "second_reminder"
  | "appointment_reminder_short"
  | "manual_reminder"

export type NotificationFailureReason = "missing_phone" | "missing_email"

export type NotificationMessage = {
  id: string
  bookingId: string
  businessSlug: string
  channel: "sms" | "email"
  type: NotificationMessageType
  recipientName: string
  recipientPhone?: string
  recipientEmail?: string
  subject?: string
  body: string
  confirmationLink: string
  status: "sent" | "simulated" | "scheduled" | "failed"
  /** Powód nieudanej wysyłki (MVP, brak prawdziwego providera). */
  failureReason?: NotificationFailureReason
  scheduledFor?: string
  sentAt?: string
  createdAt: string
  /** Powiązana wizyta (lokalna kopia historii, np. podziękowanie po wizycie). */
  relatedServiceName?: string
  relatedAppointmentDate?: string
  relatedAppointmentTime?: string
  relatedAppointmentStatus?: string
}

export type Service = {
  id: string
  businessId?: string
  name: string
  description?: string
  durationMinutes: number
  /** null = domyślna przerwa firmy (default_break_minutes). */
  breakMinutes?: number | null
  price: number
  /** Kod waluty z Supabase (np. PLN); brak przy starym localStorage. */
  currency?: string
  isActive: boolean
  /** Gdy true, publiczny booking używa godzin firmy (availability_rules). */
  usesDefaultAvailability?: boolean
}

export type StaffMember = {
  id: string
  businessId?: string
  name: string
  role?: string
  email?: string
  phone?: string
  avatarUrl?: string
  isActive: boolean
  serviceIds?: string[]
  usesDefaultAvailability?: boolean
}

export type AvailabilityDay = {
  id: string
  weekday: number
  label: string
  isOpen: boolean
  startTime: string
  endTime: string
  breakStart?: string
  breakEnd?: string
}

// ---------------------------------------------------------------------------
// Persystencja (Supabase) — modele domenowe w camelCase (mapowanie z snake_case w repozytoriach)
// Nie zastępują typów UI powyżej (Appointment, Client, MessageTemplate).
// ---------------------------------------------------------------------------

export type BusinessReminderChannelPersisted = "sms" | "email" | "both"

export type BusinessAccessStatusPersisted =
  | "trial"
  | "active"
  | "suspended"
  | "cancelled"

export type BusinessRecord = {
  id: string
  ownerUserId: string
  email: string
  businessName: string
  ownerName: string | null
  phone: string | null
  reminderChannel: BusinessReminderChannelPersisted
  defaultReminderHours: number
  accessStatus: BusinessAccessStatusPersisted
  trialStartedAt: string | null
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
}

/** Profil firmy z tabeli `business_profiles` (slug publiczny, 1:1 z owner_id). */
export type BusinessProfileRecord = {
  id: string
  ownerId: string
  businessName: string
  slug: string
  ownerName: string | null
  ownerLastName: string | null
  email: string | null
  phone: string | null
  /** Opcjonalny NIP lub inny identyfikator podatkowy (pole `tax_id` w bazie). */
  taxId: string | null
  defaultReminderHours: number
  secondReminderMinutes: number
  reminderChannel: BusinessReminderChannelPersisted
  createdAt: string
  updatedAt: string
}

/** Publiczny profil na /book/[slug]; źródło: RPC lub SELECT po `business_profiles.slug`. */
export type PublicBusinessProfileDisplay = {
  id: string
  businessName: string
  slug: string
  phone: string | null
}

export type AppointmentRecord = {
  id: string
  businessId: string
  clientId: string | null
  serviceName: string
  startsAt: string
  endsAt: string | null
  status: AppointmentStatus
  notes: string | null
  reminderSentAt: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

export type ClientRecord = {
  id: string
  businessId: string
  fullName: string
  phone: string
  email: string
  notes: string | null
  noShowCount: number
  confirmedCount: number
  cancelledCount?: number
  createdAt: string
  updatedAt: string
}

export type MessageTemplateRecord = {
  id: string
  businessId: string
  type: MessageTemplateType
  channel: MessageTemplateChannel
  title: string
  content: string
  status: MessageTemplateStatus
  createdAt: string
  updatedAt: string
}

export type PaymentTypePersisted = "deposit" | "full" | "adjustment"

export type PaymentStatusPersisted =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "canceled"

export type PaymentRecord = {
  id: string
  businessId: string
  appointmentId: string | null
  type: PaymentTypePersisted
  amount: number
  status: PaymentStatusPersisted
  createdAt: string
  updatedAt: string
}
