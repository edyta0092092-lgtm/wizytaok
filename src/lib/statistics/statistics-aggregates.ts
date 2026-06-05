import { isPlannedVisitForDashboardStats } from "@/lib/appointments/stats-rules"
import { normalizeBookingSource } from "@/lib/bookings/booking-source"
import {
  addDays,
  buildRangeBuckets,
  inStatisticsRange,
  isSameStatisticsDay,
  parseStatisticsDate,
  rangeBounds,
  startOfDay,
  startOfMonth,
} from "@/lib/statistics/statistics-range"
import type {
  StatisticsBookingChannels,
  StatisticsChartPoint,
  StatisticsDataset,
  StatisticsHeatmapItem,
  StatisticsNotificationSource,
  StatisticsRange,
  StatisticsRankItem,
  StatisticsStatusItem,
} from "@/lib/statistics/statistics-types"
import type { Appointment, Service, StaffMember } from "@/types/domain"

const STATUS_ORDER: Array<StatisticsStatusItem["status"]> = [
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]

const DAY_LABELS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"]
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function sortRank<T extends { count: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function appointmentClientKey(appointment: Appointment): string {
  const preferred =
    appointment.clientId ??
    appointment.email ??
    appointment.phone ??
    appointment.clientName
  return preferred.trim().toLowerCase()
}

function buildTopServices(
  appointments: Appointment[],
  services: Service[],
): StatisticsRankItem[] {
  const serviceNames = new Map(services.map((service) => [service.id, service.name]))
  const counts = new Map<string, { name: string; count: number }>()

  for (const appointment of appointments) {
    const id = appointment.serviceId ?? appointment.serviceLabel
    const name = serviceNames.get(id) ?? appointment.serviceLabel
    const current = counts.get(id) ?? { name, count: 0 }
    current.count += 1
    counts.set(id, current)
  }

  const total = appointments.length
  return sortRank(
    [...counts.entries()].map(([id, value]) => ({
      id,
      name: value.name,
      count: value.count,
      percent: percent(value.count, total),
    })),
  ).slice(0, 6)
}

function buildTopStaff(
  appointments: Appointment[],
  staff: StaffMember[],
  locale: "pl" | "en",
): StatisticsRankItem[] {
  const staffNames = new Map(staff.map((member) => [member.id, member.name]))
  const counts = new Map<string, { name: string; count: number; completed: number }>()

  for (const appointment of appointments) {
    const id = appointment.staffId ?? appointment.staffName ?? "unassigned"
    const name =
      staffNames.get(id) ??
      appointment.staffName ??
      (id === "unassigned"
        ? locale === "en"
          ? "Unassigned"
          : "Nie przypisano"
        : locale === "en"
          ? "Staff member"
          : "Osoba")
    const current = counts.get(id) ?? { name, count: 0, completed: 0 }
    current.count += 1
    if (appointment.status === "completed") current.completed += 1
    counts.set(id, current)
  }

  const total = appointments.length
  return sortRank(
    [...counts.entries()].map(([id, value]) => ({
      id,
      name: value.name,
      count: value.count,
      completed: value.completed,
      percent: percent(value.count, total),
    })),
  ).slice(0, 6)
}

function buildStatuses(appointments: Appointment[]): StatisticsStatusItem[] {
  const counts: Record<StatisticsStatusItem["status"], number> = {
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  }

  for (const appointment of appointments) {
    if (appointment.status === "completed") counts.completed += 1
    else if (appointment.status === "cancelled") counts.cancelled += 1
    else if (appointment.status === "no_show") counts.no_show += 1
    else counts.confirmed += 1
  }

  const total =
    counts.confirmed + counts.completed + counts.cancelled + counts.no_show

  return STATUS_ORDER.map((status) => ({
    status,
    count: counts[status],
    percent: percent(counts[status], total),
  }))
}

function buildBookingChannels(appointments: Appointment[]): StatisticsBookingChannels {
  let online = 0
  let manual = 0
  for (const appointment of appointments) {
    if (normalizeBookingSource(appointment.source) === "online") online += 1
    else manual += 1
  }
  const total = online + manual
  return {
    online,
    manual,
    onlinePercent: percent(online, total),
  }
}

function isSentStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === "sent" || normalized === "delivered" || normalized === "simulated"
}

function isFailedStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase()
  return normalized === "failed" || normalized === "error" || normalized === "bounced"
}

function buildNotificationStats(
  notifications: StatisticsNotificationSource[],
  rangeStart: Date,
  rangeEnd: Date,
) {
  let sentSms = 0
  let sentEmails = 0
  let failed = 0
  let reminderSent = 0
  let reminderFailed = 0

  for (const item of notifications) {
    const at =
      parseStatisticsDate(item.sentAt) ??
      parseStatisticsDate(item.failedAt)
    if (!inStatisticsRange(at, rangeStart, rangeEnd)) continue

    if (isSentStatus(item.status) || item.sentAt) {
      if (item.channel === "email") sentEmails += 1
      else sentSms += 1
      reminderSent += 1
    }
    if (isFailedStatus(item.status) || item.failedAt) {
      failed += 1
      reminderFailed += 1
    }
  }

  return {
    sentSms,
    sentEmails,
    failed,
    reminderSuccessRate: percent(reminderSent, reminderSent + reminderFailed),
  }
}

function buildHeatmap(
  appointments: Appointment[],
  locale: "pl" | "en",
): { busyDays: StatisticsHeatmapItem[]; busyHours: StatisticsHeatmapItem[] } {
  const dayLabels = locale === "en" ? DAY_LABELS_EN : DAY_LABELS_PL
  const dayCounts = Array.from({ length: 7 }, () => 0)
  const hourCounts = new Map<number, number>()
  let total = 0

  for (const appointment of appointments) {
    const date = parseStatisticsDate(appointment.startsAt)
    if (!date) continue
    total += 1
    const dayIndex = (date.getDay() + 6) % 7
    dayCounts[dayIndex] += 1
    const hour = date.getHours()
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  const dayShares = dayCounts.map((count) => (total > 0 ? (count / total) * 100 : 0))
  const maxDayShare = Math.max(0.0001, ...dayShares)
  const busyDays = dayShares.map((share, index) => ({
    key: String(index),
    label: dayLabels[index] ?? String(index + 1),
    count: round1(share),
    intensity: share / maxDayShare,
  }))

  const hours = Array.from({ length: 16 }, (_, index) => index + 6)
  const hourShares = hours.map((hour) =>
    total > 0 ? ((hourCounts.get(hour) ?? 0) / total) * 100 : 0,
  )
  const maxShare = Math.max(0.0001, ...hourShares)
  const busyHours = hours.map((hour, index) => ({
    key: String(hour),
    label: `${String(hour).padStart(2, "0")}:00`,
    count: round1(hourShares[index] ?? 0),
    intensity: (hourShares[index] ?? 0) / maxShare,
  }))

  return { busyDays, busyHours }
}

export function buildStatisticsDataset({
  appointments,
  services,
  staff,
  notificationSources,
  range,
  today = new Date(),
  locale = "pl",
}: {
  appointments: Appointment[]
  services: Service[]
  staff: StaffMember[]
  notificationSources: StatisticsNotificationSource[]
  range: StatisticsRange
  today?: Date
  locale?: "pl" | "en"
}): StatisticsDataset {
  const todayStart = startOfDay(today)
  const monthStart = startOfMonth(today)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const buckets = buildRangeBuckets(range, today, locale)
  const { start: rangeStart, end: rangeEnd, dayCount: rangeDayCount } = rangeBounds(
    range,
    today,
    locale,
  )

  const appointmentsInMonth = appointments.filter((appointment) =>
    inStatisticsRange(parseStatisticsDate(appointment.startsAt), monthStart, monthEnd),
  )
  const appointmentsInRange = appointments.filter((appointment) =>
    inStatisticsRange(parseStatisticsDate(appointment.startsAt), rangeStart, rangeEnd),
  )

  const visitsToday = appointments.filter(
    (appointment) =>
      isSameStatisticsDay(parseStatisticsDate(appointment.startsAt), todayStart) &&
      isPlannedVisitForDashboardStats(appointment, today),
  ).length

  const clientsBookedThisMonth = new Set<string>()
  for (const appointment of appointments) {
    const createdAt =
      parseStatisticsDate(appointment.createdAt) ??
      parseStatisticsDate(appointment.startsAt)
    if (!createdAt || !inStatisticsRange(createdAt, monthStart, monthEnd)) continue
    const key = appointmentClientKey(appointment)
    if (key) clientsBookedThisMonth.add(key)
  }

  const chart: StatisticsChartPoint[] = buckets.map((bucket) => {
    const bucketAppointments = appointments.filter((appointment) =>
      inStatisticsRange(parseStatisticsDate(appointment.startsAt), bucket.start, bucket.end),
    )
    return {
      key: bucket.key,
      label: bucket.label,
      created: bucketAppointments.length,
      completed: bucketAppointments.filter((a) => a.status === "completed").length,
      cancelled: bucketAppointments.filter((a) => a.status === "cancelled").length,
      noShow: bucketAppointments.filter((a) => a.status === "no_show").length,
    }
  })

  const bookingChannels = buildBookingChannels(appointmentsInRange)
  const heatmapAppointments = appointmentsInRange.filter((a) => a.status !== "cancelled")
  const heatmap = buildHeatmap(heatmapAppointments, locale)

  const completedAll = appointments.filter((a) => a.status === "completed").length
  const cancelledAll = appointments.filter((a) => a.status === "cancelled").length
  const noShowAll = appointments.filter((a) => a.status === "no_show").length

  let onlineAll = 0
  let manualAll = 0
  for (const appointment of appointments) {
    if (normalizeBookingSource(appointment.source) === "online") onlineAll += 1
    else manualAll += 1
  }

  return {
    kpis: {
      visitsToday,
      visitsThisMonth: appointmentsInMonth.length,
      completed: completedAll,
      cancelled: cancelledAll,
      noShow: noShowAll,
      newClients: clientsBookedThisMonth.size,
      onlineBookings: onlineAll,
      manualBookings: manualAll,
      avgDailyVisits: round1(appointmentsInRange.length / rangeDayCount),
    },
    chart,
    topServices: buildTopServices(appointmentsInRange, services),
    topStaff: buildTopStaff(appointmentsInRange, staff, locale),
    statuses: buildStatuses(appointmentsInRange),
    bookingChannels,
    notifications: buildNotificationStats(notificationSources, rangeStart, rangeEnd),
    busyDays: heatmap.busyDays,
    busyHours: heatmap.busyHours,
    totalInRange: appointmentsInRange.length,
    rangeDayCount,
  }
}
