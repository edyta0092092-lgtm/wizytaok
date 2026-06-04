import type { AppointmentStatus } from "@/types/domain"

export type StatisticsPresetRange = "7d" | "30d" | "90d" | "12m"

export type StatisticsRange =
  | StatisticsPresetRange
  | `month:${string}`
  | `year:${string}`

export type StatisticsChartPoint = {
  key: string
  label: string
  needsAction: number
  completed: number
  cancelled: number
  noShow: number
}

/** Statusy wizualizowane na wykresie „Statusy wizyt” (zgodne z KPI Łącznie). */
export type StatisticsVisitStatus = "needs_action" | "completed" | "cancelled" | "no_show"

export type StatisticsKpis = {
  // All-time totals (cumulative, regardless of the selected range / month).
  totalVisits: number
  needsAction: number
  completed: number
  cancelled: number
  noShow: number
  // Current-month metrics.
  visitsToday: number
  visitsThisMonth: number
  newClients: number
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
  notifications: StatisticsNotifications
  busyDays: StatisticsHeatmapItem[]
  busyHours: StatisticsHeatmapItem[]
  totalInRange: number
}

export type StatisticsNotificationSource = {
  channel: "sms" | "email"
  status: string
  sentAt?: string | null
  failedAt?: string | null
}
