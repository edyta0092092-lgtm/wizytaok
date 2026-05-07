import { normalizeBookingSource } from "@/lib/bookings/booking-source"
import type { Appointment, AppointmentStatus, BookingSource } from "@/types/domain"

export const MANUAL_APPOINTMENTS_STORAGE_KEY = "manual-appointments"

export type ManualAppointment = {
  id: string
  clientName: string
  clientPhone: string
  clientEmail?: string
  serviceName: string
  date: string
  time: string
  status:
    | "booked"
    | "confirmed"
    | "pending"
    | "cancelled"
    | "no_show"
  note?: string
  /** Tekst zapisywanej przez firmę propozycji alternatywnego terminu dla klienta (MVP localStorage). */
  businessNote?: string
  proposedDate?: string
  proposedTime?: string
  proposedServiceName?: string
  proposedServiceDuration?: number
  proposedServicePrice?: number
  proposedStaffId?: string
  proposedStaffName?: string
  customerNote?: string
  statusBeforeRequest?: "booked" | "confirmed"
  lastUpdatedBy?: "customer" | "business" | "system"
  updatedAt?: string
  lastStatusChangeAt?: string
  lastStatusChangeSource?: "manual" | "confirm" | "system" | "auto_reminder_24h" | "automatic_24h_reminder"
  previousDate?: string
  previousTime?: string
  previousServiceName?: string
  previousServiceDuration?: number
  previousServicePrice?: number
  lastChangeType?:
    | "business_proposal_accepted"
    | "customer_request_accepted"
    | "customer_service_request_accepted"
    | "customer_request_rejected"
    | "reminder_24h_sent"
  acceptedProposalAt?: string
  businessProposalKind?: "time" | "service" | "both"
  source: BookingSource
  createdAt: string
  /** Supabase: id usługi przy zapisie z panelu. */
  serviceId?: string
  staffId?: string
  staffName?: string
}

function normalizeManual(raw: unknown): ManualAppointment | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Partial<ManualAppointment>
  let status = o.status
  const legacy = status as string | undefined
  if (legacy === "reschedule_requested" || legacy === "business_reschedule_proposed") {
    status = "booked"
  }
  if (
    typeof o.id !== "string" ||
    typeof o.clientName !== "string" ||
    typeof o.clientPhone !== "string" ||
    typeof o.serviceName !== "string" ||
    typeof o.date !== "string" ||
    typeof o.time !== "string" ||
    (status !== "booked" &&
      status !== "confirmed" &&
      status !== "pending" &&
      status !== "cancelled" &&
      status !== "no_show")
  ) {
    return null
  }
  const statusBeforeRequest =
    o.statusBeforeRequest === "booked" || o.statusBeforeRequest === "confirmed"
      ? o.statusBeforeRequest
      : undefined
  const lastUpdatedBy =
    o.lastUpdatedBy === "customer" || o.lastUpdatedBy === "business" || o.lastUpdatedBy === "system"
      ? o.lastUpdatedBy
      : undefined
  return {
    id: o.id,
    clientName: o.clientName,
    clientPhone: o.clientPhone,
    clientEmail: typeof o.clientEmail === "string" ? o.clientEmail : undefined,
    serviceName: o.serviceName,
    date: o.date,
    time: o.time,
    status,
    note: typeof o.note === "string" ? o.note : undefined,
    businessNote: typeof o.businessNote === "string" ? o.businessNote : undefined,
    proposedDate: typeof o.proposedDate === "string" ? o.proposedDate : undefined,
    proposedTime: typeof o.proposedTime === "string" ? o.proposedTime : undefined,
    proposedServiceName:
      typeof o.proposedServiceName === "string" && o.proposedServiceName.trim().length > 0
        ? o.proposedServiceName.trim()
        : undefined,
    proposedServiceDuration:
      typeof o.proposedServiceDuration === "number" ? o.proposedServiceDuration : undefined,
    proposedServicePrice:
      typeof o.proposedServicePrice === "number" ? o.proposedServicePrice : undefined,
    proposedStaffId: typeof o.proposedStaffId === "string" ? o.proposedStaffId : undefined,
    proposedStaffName: typeof o.proposedStaffName === "string" ? o.proposedStaffName : undefined,
    customerNote: typeof o.customerNote === "string" ? o.customerNote : undefined,
    statusBeforeRequest,
    lastUpdatedBy,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : undefined,
    lastStatusChangeAt:
      typeof o.lastStatusChangeAt === "string" ? o.lastStatusChangeAt : undefined,
    lastStatusChangeSource:
      o.lastStatusChangeSource === "manual" ||
      o.lastStatusChangeSource === "confirm" ||
      o.lastStatusChangeSource === "system" ||
      o.lastStatusChangeSource === "auto_reminder_24h" ||
      o.lastStatusChangeSource === "automatic_24h_reminder"
        ? o.lastStatusChangeSource
        : undefined,
    previousDate:
      typeof o.previousDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.previousDate)
        ? o.previousDate
        : undefined,
    previousTime:
      typeof o.previousTime === "string" && /^(\d{1,2}):(\d{2})$/.test(o.previousTime.trim())
        ? o.previousTime.trim()
        : undefined,
    previousServiceName:
      typeof o.previousServiceName === "string" ? o.previousServiceName : undefined,
    previousServiceDuration:
      typeof o.previousServiceDuration === "number" ? o.previousServiceDuration : undefined,
    previousServicePrice:
      typeof o.previousServicePrice === "number" ? o.previousServicePrice : undefined,
    lastChangeType:
      o.lastChangeType === "business_proposal_accepted"
        ? "business_proposal_accepted"
        : o.lastChangeType === "customer_request_accepted"
          ? "customer_request_accepted"
          : o.lastChangeType === "customer_service_request_accepted"
            ? "customer_service_request_accepted"
            : o.lastChangeType === "customer_request_rejected"
              ? "customer_request_rejected"
              : o.lastChangeType === "reminder_24h_sent"
                ? "reminder_24h_sent"
                : undefined,
    acceptedProposalAt:
      typeof o.acceptedProposalAt === "string" ? o.acceptedProposalAt : undefined,
    businessProposalKind:
      o.businessProposalKind === "time" ||
      o.businessProposalKind === "service" ||
      o.businessProposalKind === "both"
        ? o.businessProposalKind
        : undefined,
    source: normalizeManualAppointmentSource(o.source),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    serviceId: typeof o.serviceId === "string" ? o.serviceId : undefined,
    staffId: typeof o.staffId === "string" ? o.staffId : undefined,
    staffName: typeof o.staffName === "string" ? o.staffName : undefined,
  }
}

function normalizeManualAppointmentSource(_raw: unknown): BookingSource {
  void _raw
  return "manual"
}

export function getManualAppointments(): ManualAppointment[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(MANUAL_APPOINTMENTS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeManual).filter((x): x is ManualAppointment => x !== null)
  } catch {
    return []
  }
}

export function saveManualAppointment(appointment: ManualAppointment): void {
  if (typeof window === "undefined") return
  try {
    const prev = getManualAppointments()
    prev.push(appointment)
    window.localStorage.setItem(MANUAL_APPOINTMENTS_STORAGE_KEY, JSON.stringify(prev))
    window.dispatchEvent(new Event("pw-manual-appointments"))
  } catch {
    // noop
  }
}

/** Aktualizuje wpis po surowym `id` manualnym (bez prefiksu `ma-`). */
export function updateManualAppointment(
  id: string,
  patch: Partial<Omit<ManualAppointment, "id">>
): boolean {
  if (typeof window === "undefined") return false
  try {
    const prev = getManualAppointments()
    const idx = prev.findIndex((x) => x.id === id)
    if (idx === -1) return false
    const updated: ManualAppointment = {
      ...prev[idx],
      ...patch,
      id: prev[idx].id,
      source:
        patch.source !== undefined
          ? normalizeManualAppointmentSource(patch.source)
          : prev[idx].source,
    }
    const next = [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)]
    window.localStorage.setItem(MANUAL_APPOINTMENTS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event("pw-manual-appointments"))
    return true
  } catch {
    return false
  }
}

export function deleteManualAppointment(id: string): void {
  if (typeof window === "undefined") return
  try {
    const prev = getManualAppointments()
    const next = prev.filter((x) => x.id !== id)
    window.localStorage.setItem(MANUAL_APPOINTMENTS_STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event("pw-manual-appointments"))
  } catch {
    // noop
  }
}

export function unwrapManualAppointmentId(uiId: string): string | null {
  const s = typeof uiId === "string" ? uiId.trim() : ""
  return s.startsWith("ma-") ? s.slice(3) : null
}

export function mapManualToAppointment(m: ManualAppointment): Appointment {
  const status: AppointmentStatus = m.status
  return {
    id: `ma-${m.id}`,
    clientName: m.clientName,
    phone: m.clientPhone,
    email: m.clientEmail,
    serviceLabel: m.serviceName,
    startsAt: new Date(`${m.date}T${m.time}:00`).toISOString(),
    status,
    source: normalizeBookingSource(m.source),
    notes: m.note,
    proposedDate: m.proposedDate,
    proposedTime: m.proposedTime,
    proposedServiceName: m.proposedServiceName,
    proposedServiceDuration: m.proposedServiceDuration,
    proposedServicePrice: m.proposedServicePrice,
    proposedStaffId: m.proposedStaffId,
    proposedStaffName: m.proposedStaffName,
    customerNote: m.customerNote,
    businessNote: m.businessNote,
    lastUpdatedBy: m.lastUpdatedBy,
    statusBeforeRequest: m.statusBeforeRequest,
    previousDate: m.previousDate,
    previousTime: m.previousTime,
    previousServiceName: m.previousServiceName,
    previousServiceDuration: m.previousServiceDuration,
    previousServicePrice: m.previousServicePrice,
    lastChangeType: m.lastChangeType,
    acceptedProposalAt: m.acceptedProposalAt,
    businessProposalKind: m.businessProposalKind,
    lastStatusChangeAt: m.lastStatusChangeAt,
    lastStatusChangeSource: m.lastStatusChangeSource,
    serviceId: m.serviceId,
    staffId: m.staffId,
    staffName: m.staffName,
  }
}
