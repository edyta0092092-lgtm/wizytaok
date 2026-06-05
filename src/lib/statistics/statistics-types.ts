import type { AppointmentStatus } from "@/types/domain"

export type StatisticsPresetRange = "7d" | "30d" | "90d" | "12m"

export type StatisticsRange =
  | StatisticsPresetRange
  | `month:${string}`
  | `year:${string}`

export type StatisticsChartPoint = {
  key: string
  label: string
  /** Wszystkie wizyty w bucketcie (wg daty wizyty). */
  created: number
  completed: number
  cancelled: number
  noShow: number
}

/** Statusy na wykresie „Statusy wizyt”. */
export type StatisticsVisitStatus = "confirmed" | "completed" | "cancelled" | "no_show"

export type StatisticsKpis = {
  visitsToday: number
  visitsThisMonth: number
  completed: number
  cancelled: number
  noShow: number
  newClients: number
  onlineBookings: number
  manualBookings: number
  /** Średnia dzienna w wybranym zakresie trendu (zaokrąglona do 1 miejsca). */
  avgDailyVisits: number
}

export type StatisticsBookingChannels = {
  online: number
  manual: number
  onlinePercent: number
}

export type StatisticsRankItem = {
  id: string
  name: string
  count: number
  completed?: number
  percent: number
}

export type StatisticsStatusItem = {
  status: StatisticsVisitStatus
  count: number
  percent: number
}

export type StatisticsNotifications = {
  sentSms: number
  sentEmails: number
  failed: number
  reminderSuccessRate: number
}

export type StatisticsHeatmapItem = {
  key: string
  label: string
  count: number
  intensity: number
}

export type StatisticsDataset = {
  kpis: StatisticsKpis
  chart: StatisticsChartPoint[]
  topServices: StatisticsRankItem[]
  topStaff: StatisticsRankItem[]
  statuses: StatisticsStatusItem[]
  bookingChannels: StatisticsBookingChannels
  notifications: StatisticsNotifications
  busyDays: StatisticsHeatmapItem[]
  busyHours: StatisticsHeatmapItem[]
  totalInRange: number
  rangeDayCount: number
}

export type StatisticsNotificationSource = {
  channel: "sms" | "email"
  status: string
  sentAt?: string | null
  failedAt?: string | null
}

/** @internal agregaty statusów DB */
export type StatisticsRawStatusCounts = Record<AppointmentStatus, number>
