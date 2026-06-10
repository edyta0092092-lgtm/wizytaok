import { getAppToday } from "@/lib/date/current-date"
import { groupAppointmentByDay, type AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import type { Appointment } from "@/types/domain"

export type AppointmentsMobilePeriodFilter = "today" | "tomorrow" | "week"

export const APPOINTMENTS_MOBILE_PERIOD_FILTERS: AppointmentsMobilePeriodFilter[] = [
  "today",
  "tomorrow",
  "week",
]

function startOfLocalDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function appointmentsMobilePeriodLabel(
  value: AppointmentsMobilePeriodFilter,
  t: (key: string) => string,
): string {
  if (value === "today") return t("appointments.today")
  if (value === "tomorrow") return t("appointments.tomorrow")
  return t("appointments.mobilePeriodWeek")
}

export function selectMobilePeriodRows(
  grouped: Record<AppointmentGroupKey, Appointment[]>,
  period: AppointmentsMobilePeriodFilter,
  now = getAppToday(),
): Appointment[] {
  if (period === "today") return grouped.today
  if (period === "tomorrow") return grouped.tomorrow

  const todayStart = startOfLocalDay(now)
  const weekEnd = todayStart + 7 * 86_400_000
  const sortStarts = (a: Appointment, b: Appointment) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()

  return [...grouped.today, ...grouped.tomorrow, ...grouped.upcoming]
    .filter((row) => {
      const day = startOfLocalDay(new Date(row.startsAt))
      return day >= todayStart && day < weekEnd
    })
    .sort(sortStarts)
}

export function appointmentMatchesMobilePeriod(
  startsAt: string,
  period: AppointmentsMobilePeriodFilter,
  now = getAppToday(),
): boolean {
  if (period === "today") return groupAppointmentByDay(startsAt, now) === "today"
  if (period === "tomorrow") return groupAppointmentByDay(startsAt, now) === "tomorrow"
  const day = startOfLocalDay(new Date(startsAt))
  const todayStart = startOfLocalDay(now)
  return day >= todayStart && day < todayStart + 7 * 86_400_000
}
