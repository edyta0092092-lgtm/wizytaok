import type { AppointmentStatus } from "@/types/domain"

export type AppointmentsListFilter =
  | "all"
  | AppointmentStatus
  | "unconfirmed"
  | "needs_action"

/** Widoczne przyciski statusu na liście wizyt (pozostałe statusy tylko w danych / starych linkach). */
export const APPOINTMENTS_STATUS_FILTERS: AppointmentsListFilter[] = [
  "all",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
]

const URL_STATUS_FILTERS = new Set<AppointmentsListFilter>(APPOINTMENTS_STATUS_FILTERS)

export function normalizeAppointmentsStatusFilterFromUrl(
  raw: string | null | undefined,
): AppointmentsListFilter {
  const value = String(raw ?? "").trim() as AppointmentsListFilter
  if (URL_STATUS_FILTERS.has(value)) return value
  return "all"
}

export function appointmentsStatusFilterLabel(
  value: AppointmentsListFilter,
  t: (key: string) => string,
): string {
  if (value === "all") return t("appointments.all")
  if (value === "confirmed") return t("appointments.confirmed")
  if (value === "cancelled") return t("appointments.cancelled")
  if (value === "completed") return t("appointments.completed")
  if (value === "no_show") return t("appointments.noShow")
  return value
}
