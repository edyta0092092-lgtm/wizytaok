import type { Tables } from "@/types/database"
import type {
  AppointmentStatus,
  AppointmentRecord,
  BusinessProfileRecord,
  BusinessRecord,
  BusinessReminderChannelPersisted,
  ClientRecord,
  MessageTemplateRecord,
  MessageTemplateType,
  PaymentRecord,
} from "@/types/domain"

function mapAppointmentStatus(status: Tables<"appointments">["status"]): AppointmentStatus {
  if (status === "pending") return "confirmed"
  if (status === "change_requested") return "booked"
  return status
}

export function mapBusinessRow(row: Tables<"businesses">): BusinessRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    email: row.email,
    businessName: row.business_name,
    ownerName: row.owner_name,
    phone: row.phone,
    reminderChannel: row.reminder_channel,
    defaultReminderHours: row.default_reminder_hours,
    accessStatus: row.access_status,
    trialStartedAt: row.trial_started_at,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function coerceBusinessReminderChannel(raw: string | null | undefined): BusinessReminderChannelPersisted {
  if (raw === "sms" || raw === "email" || raw === "both") return raw
  return "both"
}

export function mapBusinessProfileRow(row: Tables<"business_profiles">): BusinessProfileRecord {
  const hours =
    typeof row.default_reminder_hours === "number" && Number.isFinite(row.default_reminder_hours)
      ? row.default_reminder_hours
      : 24
  return {
    id: row.id,
    ownerId: row.owner_id,
    businessName: row.business_name,
    slug: row.slug,
    ownerName: row.owner_name,
    ownerLastName: row.owner_last_name ?? null,
    email: row.email,
    phone: row.phone,
    taxId: row.tax_id ?? null,
    defaultReminderHours: hours,
    secondReminderMinutes:
      typeof row.second_reminder_minutes === "number" && Number.isFinite(row.second_reminder_minutes)
        ? row.second_reminder_minutes
        : 120,
    reminderChannel: coerceBusinessReminderChannel(row.reminder_channel),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapAppointmentRow(row: Tables<"appointments">): AppointmentRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    clientId: row.client_id,
    serviceName: row.service_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: mapAppointmentStatus(row.status),
    notes: row.notes,
    reminderSentAt: row.reminder_sent_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapClientRow(row: Tables<"clients">): ClientRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    noShowCount: row.no_show_count,
    confirmedCount: row.confirmed_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMessageTemplateTypeFromDb(raw: string): MessageTemplateType {
  if (raw === "reschedule") return "reminder"
  return raw as MessageTemplateType
}

export function mapTemplateRow(
  row: Tables<"message_templates">
): MessageTemplateRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    type: mapMessageTemplateTypeFromDb(row.type),
    channel: row.channel,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPaymentRow(row: Tables<"payments">): PaymentRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    appointmentId: row.appointment_id,
    type: row.type,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
