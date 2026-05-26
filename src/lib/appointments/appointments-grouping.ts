import { getAppToday } from "@/lib/date/current-date"

export type AppointmentGroupKey = "past" | "today" | "tomorrow" | "upcoming"

export const APPOINTMENT_GROUP_ORDER: AppointmentGroupKey[] = ["past", "today", "tomorrow", "upcoming"]

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
