export type ClientPortalTone = "friendly" | "professional" | "concise"

export type ClientBookingStatus =
  | "confirmed"
  | "pending"
  | "cancelled"
  | "completed"
  | "no_show"
  | string

export type ClientPortalBooking = {
  id: string
  businessId: string
  businessName: string
  businessSlug: string | null
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  startsAtIso: string
  status: ClientBookingStatus
  staffName: string | null
  confirmationToken: string | null
}

export type ClientPortalProfile = {
  firstName: string
  lastName: string
  phone: string
  email: string
}

export type ClientPortalNotification = {
  id: string
  channel: "sms" | "email" | string
  type: string
  status: string
  subject: string | null
  bodyPreview: string | null
  sentAt: string | null
  createdAt: string
  bookingId: string | null
}

export type ClientPortalDashboard = {
  nextBooking: ClientPortalBooking | null
  visitCount: number
  lastServiceName: string | null
  upcoming: ClientPortalBooking[]
  history: ClientPortalBooking[]
}
