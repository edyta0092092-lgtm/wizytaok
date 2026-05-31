import { getAppToday } from "@/lib/date/current-date"

export type AppointmentGroupKey = "past" | "today" | "tomorrow" | "upcoming"

export const APPOINTMENT_GROUP_ORDER: AppointmentGroupKey[] = [
  "today",
  "tomorrow",
  "upcoming",
  "past",
]

export type AppointmentsDayGroupFilter = "all" | AppointmentGroupKey

export const APPOINTMENTS_DAY_GROUP_FILTERS: AppointmentsDayGroupFilter[] = [
  "all",
  "today",
  "tomorrow",
  "upcoming",
  "past",
]

export function appointmentsDayGroupFilterLabel(
  value: AppointmentsDayGroupFilter,
  t: (key: string) => string,
): string {
  if (value === "all") return t("appointments.dayGroupFilterAll")
  if (value === "past") return t("appointments.past")
  if (value === "today") return t("appointments.today")
  if (value === "tomorrow") return t("appointments.tomorrow")
  return t("appointments.upcoming")
}

function startOfLocalDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

/** Dzieli wizyty na dziś / jutro / później (wg zegara aplikacji). */
export function groupAppointmentByDay(
  startsAt: string,
  now = getAppToday()
): AppointmentGroupKey {
  const apt = startOfLocalDay(new Date(startsAt))
  const today = startOfLocalDay(now)
  const tomorrow = today + 86400000
  if (apt < today) return "past"
  if (apt === today) return "today"
  if (apt === tomorrow) return "tomorrow"
  return "upcoming"
}
