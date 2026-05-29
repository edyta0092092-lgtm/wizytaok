"use client"

import * as React from "react"

import { useAppointmentsStore } from "@/lib/appointments/appointments-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getNotificationMessages } from "@/lib/notifications/notifications"
import { getServices } from "@/lib/services/services-store"
import { getStaffForBusiness } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { buildStatisticsDataset } from "@/lib/statistics/statistics-aggregates"
import type {
  StatisticsDataset,
  StatisticsNotificationSource,
  StatisticsRange,
  StatisticsStatusItem,
} from "@/lib/statistics/statistics-types"
import type { Service, StaffMember } from "@/types/domain"

type StatisticsState = {
  ready: boolean
  loadError: boolean
  dataset: StatisticsDataset | null
  statuses: StatisticsStatusItem[] | null
  availableMonths: string[]
  appointmentsReady: boolean
}

function monthKeyFromValue(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function normalizeChannel(value: unknown): "sms" | "email" {
  return String(value ?? "").trim().toLowerCase() === "email" ? "email" : "sms"
}

function buildLocalNotificationSources(): StatisticsNotificationSource[] {
  return getNotificationMessages().map((message) => ({
    channel: message.channel,
    status: message.status,
    sentAt: message.sentAt ?? null,
    failedAt: message.status === "failed" ? message.createdAt : null,
  }))
}

async function fetchNotificationSources(
  businessId: string | null
): Promise<StatisticsNotificationSource[]> {
  const localSources = buildLocalNotificationSources()
  if (!isSupabaseConfigured() || !businessId) return localSources
  const client = getBrowserClient()
  if (!client) return localSources

  const sources: StatisticsNotificationSource[] = [...localSources]

  const [logsResult, remindersResult] = await Promise.all([
    client
      .from("notification_logs")
      .select("channel, status, sent_at, created_at")
      .eq("business_id", businessId)
      .limit(5000),
    client
      .from("appointment_reminders")
      .select("channel, status, sent_at, failed_at, created_at")
      .eq("business_id", businessId)
      .limit(5000),
  ])

  if (!logsResult.error && logsResult.data) {
    for (const row of logsResult.data) {
      sources.push({
        channel: normalizeChannel(row.channel),
        status: String(row.status ?? ""),
        sentAt: row.sent_at,
        failedAt: String(row.status ?? "").toLowerCase() === "failed" ? row.created_at : null,
      })
    }
  }

  if (!remindersResult.error && remindersResult.data) {
    for (const row of remindersResult.data) {
      sources.push({
        channel: normalizeChannel(row.channel),
        status: String(row.status ?? ""),
        sentAt: row.sent_at,
        failedAt: row.failed_at,
      })
    }
  }

  return sources
}

export function useStatisticsData({
  range,
  statusRange,
  locale,
}: {
  range: StatisticsRange
  statusRange?: StatisticsRange
  locale: "pl" | "en"
}): StatisticsState {
  const access = useBusinessAccess()
  const {
    appointments,
    ready: appointmentsReady,
    loadError: appointmentsLoadError,
  } = useAppointmentsStore(access.ready ? access.businessId : undefined)
  const [services, setServices] = React.useState<Service[]>([])
  const [staff, setStaff] = React.useState<StaffMember[]>([])
  const [notificationSources, setNotificationSources] = React.useState<
    StatisticsNotificationSource[]
  >([])
  const [detailsReady, setDetailsReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setDetailsReady(false)
      setLoadError(false)
    })

    void (async () => {
      try {
        const client = getBrowserClient()
        const businessId = access.businessId
        const [nextServices, nextStaff, nextNotifications] = await Promise.all([
          getServices(client, businessId),
          getStaffForBusiness(client, businessId),
          fetchNotificationSources(businessId),
        ])

        if (cancelled) return
        setServices(nextServices)
        setStaff(nextStaff)
        setNotificationSources(nextNotifications)
        setDetailsReady(true)
      } catch {
        if (cancelled) return
        setLoadError(true)
        setDetailsReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [access.businessId])

  const dataset = React.useMemo(() => {
    if (!appointmentsReady || !detailsReady) return null
    return buildStatisticsDataset({
      appointments,
      services,
      staff,
      notificationSources,
      range,
      locale,
    })
  }, [
    appointments,
    appointmentsReady,
    detailsReady,
    locale,
    notificationSources,
    range,
    services,
    staff,
  ])

  const effectiveStatusRange = statusRange ?? range
  const statuses = React.useMemo(() => {
    if (!appointmentsReady || !detailsReady) return null
    if (effectiveStatusRange === range) return dataset?.statuses ?? null
    return buildStatisticsDataset({
      appointments,
      services,
      staff,
      notificationSources,
      range: effectiveStatusRange,
      locale,
    }).statuses
  }, [
    appointments,
    appointmentsReady,
    dataset,
    detailsReady,
    effectiveStatusRange,
    locale,
    notificationSources,
    range,
    services,
    staff,
  ])

  const availableMonths = React.useMemo(() => {
    const months = new Set<string>()
    // Current month is always offered because it is the default range.
    const now = new Date()
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    // Other months show up only when a visit actually takes place in them
    // (by the appointment date), so new months appear automatically.
    for (const appointment of appointments) {
      const startMonth = monthKeyFromValue(appointment.startsAt)
      if (startMonth) months.add(startMonth)
    }
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [appointments])

  return {
    ready: appointmentsReady && detailsReady,
    loadError: appointmentsLoadError || loadError,
    dataset,
    statuses,
    availableMonths,
    appointmentsReady,
  }
}
