/** Lokalna kopia wpisu historii wysyłek (gdy DB/RLS opóźnia odczyt). */
export type TransactionalHistoryMirror = {
  bookingUiId: string
  businessSlug: string
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  confirmationToken: string
  serviceName: string | null
  appointmentDate: string | null
  appointmentTime: string | null
  appointmentStatus: string | null
  smsBody: string | null
  emailSubject: string | null
  emailBody: string | null
}

export type TransactionalHistoryMessageType =
  | "thank_you_after_visit"
  | "booking_cancelled_by_company"
  | "no_show_follow_up"
