import type { AppointmentStatus } from "@/types/domain"
import type { SemanticStatusTone } from "@/components/shared/status-tone"

/** Kolory statusów zgodne z grafikiem dziennym i statystykami. */
export function appointmentStatusTone(status: AppointmentStatus): SemanticStatusTone {
  switch (status) {
    case "confirmed":
    case "booked":
    case "pending":
      return "info"
    case "completed":
      return "violet"
    case "no_show":
      return "warning"
    case "cancelled":
      return "neutral"
    default:
      return "neutral"
  }
}

export function appointmentStatusStripeClass(status: AppointmentStatus): string {
  switch (status) {
    case "confirmed":
    case "booked":
    case "pending":
      return "bg-sky-500"
    case "completed":
      return "bg-violet-500"
    case "no_show":
      return "bg-amber-500"
    case "cancelled":
      return "bg-slate-400"
    default:
      return "bg-border"
  }
}
