import type { AppointmentStatus, ClientAttachment } from "@/types/domain"

/** Segment CRM — automatyczna klasyfikacja klienta. */
export type CustomerSegment = "new" | "returning" | "loyal" | "lost"

export type CustomerVisitRow = {
  id: string
  appointmentId?: string
  startsAt: string
  serviceLabel: string
  staffName: string
  status: AppointmentStatus
}

export type CustomerCrmRow = {
  id: string
  fullName: string
  firstName: string
  lastName: string
  phone: string
  email: string
  visitCount: number
  completedCount: number
  cancelledCount: number
  noShowCount: number
  lastVisitAt: string | null
  nextVisitAt: string | null
  firstVisitAt: string | null
  segment: CustomerSegment
  visits: CustomerVisitRow[]
  notes?: string
  attachments: ClientAttachment[]
}

export type CustomerKpis = {
  totalCustomers: number
  newThisMonth: number
}

export type CustomerSegmentFilter = CustomerSegment | "all"
