import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"

export const EMPTY_MANUAL_APPOINTMENT_FORM: ManualAppointmentFormState = {
  clientFirstName: "",
  clientLastName: "",
  clientPhone: "",
  clientEmail: "",
  serviceId: "",
  manualStaffId: "",
  date: "",
  time: "",
  status: "booked",
  note: "",
}
