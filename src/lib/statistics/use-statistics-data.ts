"use client"

import * as React from "react"

import { useAppointmentsStore } from "@/lib/appointments/appointments-store"
import { SB_BOOKING_PREFIX } from "@/lib/bookings/bookings-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getNotificationMessages } from "@/lib/notifications/notifications"
import { getServices } from "@/lib/services/services-store"
import { getStaffForBusiness } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { buildStatisticsDataset } from "@/lib/statistics/statistics-aggregates"
import type {
  StatisticsAppointmentMeta,
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

async function fetchBookingMeta(
  businessId: string | null
): Promise<Map<string, StatisticsAppointmentMeta>> {
  const out = new Map<string, StatisticsAppointmentMeta>()
  if (!isSupabaseConfigured() || !businessId) return out
  const client = getBrowserClient()
  if (!client) return out

  const { data, error } = await client
    .from("bookings")
    .select("id, created_at")
    .eq("business_id", businessId)
    .limit(5000)

  if (error || !data) return out
  for (const row of data) {
    const createdAt = typeof row.created_at === "string" ? row.created_at : undefined
    out.set(row.id, { createdAt })
    out.set(`${SB_BOOKING_PREFIX}${row.id}`, { createdAt })
  }
  return out
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
  const [appointmentMeta, setAppointmentMeta] = React.useState<
    Map<string, StatisticsAppointmentMeta>
  >(() => new Map())
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
        const [nextServices, nextStaff, nextMeta, nextNotifications] = await Promise.all([
          getServices(client, businessId),
          getStaffForBusiness(client, businessId),
          fetchBookingMeta(businessId),
          fetchNotificationSources(businessId),
        ])

        if (cancelled) return
        setServices(nextServices)
        setStaff(nextStaff)
        setAppointmentMeta(nextMeta)
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
      appointmentMeta,
      range,
      locale,
    })
  }, [
    appointmentMeta,
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
      appointmentMeta,
      range: effectiveStatusRange,
      locale,
    }).statuses
  }, [
    appointmentMeta,
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
    // Current month is always selectable so there is a sensible default.
    const now = new Date()
    months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
    // A month shows up as soon as any visit falls into it (by visit date or
    // creation date), so new months appear automatically when used.
    for (const appointment of appointments) {
      const startMonth = monthKeyFromValue(appointment.startsAt)
      if (startMonth) months.add(startMonth)
      const createdMonth = monthKeyFromValue(appointmentMeta.get(appointment.id)?.createdAt)
      if (createdMonth) months.add(createdMonth)
    }
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [appointments, appointmentMeta])

  return {
    ready: appointmentsReady && detailsReady,
    loadError: appointmentsLoadError || loadError,
    dataset,
    statuses,
    availableMonths,
    appointmentsReady,
  }
}
