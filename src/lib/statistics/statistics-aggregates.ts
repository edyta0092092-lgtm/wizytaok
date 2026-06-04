import {
  countStatisticsNeedsActionVisits,
  isPlannedVisitForDashboardStats,
} from "@/lib/appointments/stats-rules"
import type { Appointment, AppointmentStatus, Service, StaffMember } from "@/types/domain"
import type {
  StatisticsChartPoint,
  StatisticsDataset,
  StatisticsHeatmapItem,
  StatisticsNotificationSource,
  StatisticsRange,
  StatisticsRankItem,
  StatisticsStatusItem,
} from "@/lib/statistics/statistics-types"

const STATUS_ORDER: Array<StatisticsStatusItem["status"]> = [
  "completed",
  "cancelled",
  "no_show",
]

const DAY_LABELS_PL = ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Nd"]
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function inRange(date: Date | null, start: Date, end: Date): boolean {
  if (!date) return false
  const time = date.getTime()
  return time >= start.getTime() && time < end.getTime()
}

function isSameDay(a: Date | null, b: Date): boolean {
  if (!a) return false
  return dayKey(a) === dayKey(b)
}

function appointmentClientKey(appointment: Appointment): string {
  const preferred =
    appointment.clientId ??
    appointment.email ??
    appointment.phone ??
    appointment.clientName
  return preferred.trim().toLowerCase()
}

function buildRangeBuckets(
  range: StatisticsRange,
  today: Date,
  locale: "pl" | "en"
): Array<{ key: string; label: string; start: Date; end: Date }> {
  const dayFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pl-PL", {
    day: "2-digit",
    month: "2-digit",
  })
  const monthFormatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "pl-PL", {
    month: "short",
  })
  const end = addDays(startOfDay(today), 1)

  if (range.startsWith("month:")) {
    const [year, month] = range
      .slice("month:".length)
      .split("-")
      .map((value) => Number(value))
    const monthStart = new Date(year, (month || 1) - 1, 1)
    const monthEnd = new Date(year, month || 1, 1)
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    let cursor = monthStart
    while (cursor < monthEnd) {
      const bucketEnd = addDays(cursor, 1)
      buckets.push({
        key: dayKey(cursor),
        label: dayFormatter.format(cursor),
        start: cursor,
        end: bucketEnd,
      })
      cursor = bucketEnd
    }
    return buckets
  }

  if (range.startsWith("year:")) {
    const year = Number(range.slice("year:".length))
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(year, month, 1)
      const next = new Date(year, month + 1, 1)
      buckets.push({
        key: monthKey(start),
        label: monthFormatter.format(start),
        start,
        end: next,
      })
    }
    return buckets
  }

  if (range === "12m") {
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
      buckets.push({
        key: monthKey(start),
        label: monthFormatter.format(start),
        start,
        end: next,
      })
    }
    return buckets
  }

  if (range === "90d") {
    const start = startOfDay(addDays(end, -90))
    const buckets: Array<{ key: string; label: string; start: Date; end: Date }> = []
    let cursor = start
    while (cursor < end) {
      const bucketEnd = addDays(cursor, 7)
      const cappedEnd = bucketEnd.getTime() > end.getTime() ? end : bucketEnd
      const lastDay = addDays(cappedEnd, -1)
      buckets.push({
        key: `${dayKey(cursor)}-week`,
        label: `${dayFormatter.format(cursor)}–${dayFormatter.format(lastDay)}`,
        start: cursor,
        end: cappedEnd,
      })
      cursor = cappedEnd
    }
    return buckets
  }

  const days = range === "7d" ? 7 : 30
  const start = addDays(end, -days)
  return Array.from({ length: days }, (_, index) => {
    const bucketStart = addDays(start, index)
    const bucketEnd = addDays(bucketStart, 1)
    return {
      key: dayKey(bucketStart),
      label: dayFormatter.format(bucketStart),
      start: bucketStart,
      end: bucketEnd,
    }
  })
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((part / total) * 100)
}

function sortRank<T extends { count: number; name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function buildTopServices(
  appointments: Appointment[],
  services: Service[]
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
    }))
  ).slice(0, 6)
}

function buildTopStaff(
  appointments: Appointment[],
  staff: StaffMember[],
  locale: "pl" | "en"
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
    }))
  ).slice(0, 6)
}

function buildStatuses(appointments: Appointment[]): StatisticsStatusItem[] {
  const total = appointments.filter((appointment) =>
    STATUS_ORDER.includes(appointment.status as StatisticsStatusItem["status"])
  ).length

  return STATUS_ORDER.map((status) => {
    const count = appointments.filter((appointment) => appointment.status === status).length
    return { status, count, percent: percent(count, total) }
  })
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
  appointments: Appointment[]
) {
  let sentSms = 0
  let sentEmails = 0
  let failed = 0
  let reminderSent = 0
  let reminderFailed = 0

  for (const item of notifications) {
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

  for (const appointment of appointments) {
    const reminderPairs = [
      [appointment.reminderStatus, appointment.reminderSentAt, appointment.reminderError],
      [appointment.firstReminderStatus, appointment.firstReminderSentAt, appointment.reminderError],
      [appointment.secondReminderStatus, appointment.secondReminderSentAt, appointment.secondReminderError],
    ] as const
    for (const [status, sentAt, error] of reminderPairs) {
      if (sentAt || (status && isSentStatus(status))) reminderSent += 1
      if (error || (status && isFailedStatus(status))) {
        failed += 1
        reminderFailed += 1
      }
    }
  }

  return {
    sentSms,
    sentEmails,
    failed,
    reminderSuccessRate: percent(reminderSent, reminderSent + reminderFailed),
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function buildHeatmap(
  appointments: Appointment[],
  locale: "pl" | "en"
): { busyDays: StatisticsHeatmapItem[]; busyHours: StatisticsHeatmapItem[] } {
  const dayLabels = locale === "en" ? DAY_LABELS_EN : DAY_LABELS_PL
  const dayCounts = Array.from({ length: 7 }, () => 0)
  const hourCounts = new Map<number, number>()
  let total = 0

  for (const appointment of appointments) {
    const date = parseDate(appointment.startsAt)
    if (!date) continue
    total += 1
    const dayIndex = (date.getDay() + 6) % 7
    dayCounts[dayIndex] += 1
    const hour = date.getHours()
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }

  // Days: how often each weekday is chosen, as a share (%) of all visits in
  // the range. Shows which weekdays are the most popular / busiest.
  const dayShares = dayCounts.map((count) => (total > 0 ? (count / total) * 100 : 0))
  const maxDayShare = Math.max(0.0001, ...dayShares)
  const busyDays = dayShares.map((share, index) => ({
    key: String(index),
    label: dayLabels[index] ?? String(index + 1),
    count: round1(share),
    intensity: share / maxDayShare,
  }))

  // Hours: how often each hour is chosen, as a share (%) of all visits in the
  // range. Shows which time slots are the most popular / busiest.
  const hours = Array.from({ length: 16 }, (_, index) => index + 6)
  const hourShares = hours.map((hour) =>
    total > 0 ? ((hourCounts.get(hour) ?? 0) / total) * 100 : 0
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
  const tomorrowStart = addDays(todayStart, 1)
  const monthStart = startOfMonth(today)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const buckets = buildRangeBuckets(range, today, locale)
  const rangeStart = buckets[0]?.start ?? monthStart
  const rangeEnd = buckets[buckets.length - 1]?.end ?? tomorrowStart

  const appointmentsInMonth = appointments.filter((appointment) =>
    inRange(parseDate(appointment.startsAt), monthStart, monthEnd)
  )
  const appointmentsInRange = appointments.filter((appointment) =>
    inRange(parseDate(appointment.startsAt), rangeStart, rangeEnd)
  )
  const visitsToday = appointments.filter(
    (appointment) =>
      isSameDay(parseDate(appointment.startsAt), todayStart) &&
      isPlannedVisitForDashboardStats(appointment, today)
  ).length

  // Clients who made any reservation in the current month (by booking creation
  // date, regardless of when the visit itself takes place). Scoped to this
  // month, so the counter naturally resets when a new month starts.
  const clientsBookedThisMonth = new Set<string>()
  for (const appointment of appointments) {
    const createdAt = parseDate(appointment.createdAt) ?? parseDate(appointment.startsAt)
    if (!createdAt || !inRange(createdAt, monthStart, monthEnd)) continue
    const key = appointmentClientKey(appointment)
    if (key) clientsBookedThisMonth.add(key)
  }
  const newClients = clientsBookedThisMonth.size
  const chart: StatisticsChartPoint[] = buckets.map((bucket) => {
    const bucketAppointments = appointments.filter((appointment) =>
      inRange(parseDate(appointment.startsAt), bucket.start, bucket.end)
    )
    return {
      key: bucket.key,
      label: bucket.label,
      confirmed: bucketAppointments.filter(
        (appointment) =>
          appointment.status === "confirmed" ||
          appointment.status === "booked" ||
          appointment.status === "pending"
      ).length,
      completed: bucketAppointments.filter((appointment) => appointment.status === "completed").length,
      cancelled: bucketAppointments.filter((appointment) => appointment.status === "cancelled").length,
      noShow: bucketAppointments.filter((appointment) => appointment.status === "no_show").length,
    }
  })

  // All-time status totals (cumulative across every appointment, independent of
  // the selected range / current month).
  const statusCounts = appointments.reduce<Record<AppointmentStatus, number>>(
    (acc, appointment) => {
      acc[appointment.status] += 1
      return acc
    },
    {
      booked: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      completed: 0,
      no_show: 0,
    }
  )
  const heatmapAppointments = appointmentsInRange.filter(
    (appointment) => appointment.status !== "cancelled"
  )
  const heatmap = buildHeatmap(heatmapAppointments, locale)

  const needsAction = countStatisticsNeedsActionVisits(appointments, today)
  const completed = statusCounts.completed
  const cancelled = statusCounts.cancelled
  const noShow = statusCounts.no_show

  return {
    kpis: {
      totalVisits: completed + cancelled + noShow + needsAction,
      needsAction,
      completed,
      cancelled,
      noShow,
      visitsToday,
      visitsThisMonth: appointmentsInMonth.length,
      newClients,
    },
    chart,
    topServices: buildTopServices(appointmentsInRange, services),
    topStaff: buildTopStaff(appointmentsInRange, staff, locale),
    statuses: buildStatuses(appointmentsInRange),
    notifications: buildNotificationStats(notificationSources, appointmentsInRange),
    busyDays: heatmap.busyDays,
    busyHours: heatmap.busyHours,
    totalInRange: appointmentsInRange.length,
  }
}
