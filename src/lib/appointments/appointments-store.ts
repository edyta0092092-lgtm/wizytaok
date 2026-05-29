"use client"

import * as React from "react"

import { initialAppointmentsList } from "@/data/mock-appointments"
import {
  getManualAppointments,
  mapManualToAppointment,
  updateManualAppointment,
  unwrapManualAppointmentId,
} from "@/lib/appointments/manual-appointments"
import {
  getPublicBookings,
  mapPublicBookingToAppointment,
  type PublicBookingStatus,
  updatePublicBooking,
  unwrapPublicAppointmentId,
} from "@/lib/bookings/public-bookings"
import {
  getCachedMergedAppointments,
  invalidateMergedAppointmentsCache,
  mergedAppointmentsCacheKey,
  setCachedMergedAppointments,
} from "@/lib/appointments/merged-appointments-cache"
import {
  getBookingsForCurrentBusiness,
  SB_BOOKING_PREFIX,
  unwrapSupabaseBookingAppointmentId,
  updateBookingStatus,
} from "@/lib/bookings/bookings-store"
import { DEMO_BOOKING_SLUG, normalizePublicSlug } from "@/lib/business/slug"
import { appointmentRequiresBusinessContact } from "@/lib/appointments/stats-rules"
import { getAppToday, isSameAppDay } from "@/lib/date/current-date"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import type { Appointment, AppointmentStatus } from "@/types/domain"

const APPOINTMENT_STATUS_OVERRIDES_STORAGE_KEY = "appointment-status-overrides"
const BOOKINGS_REALTIME_FALLBACK_POLL_MS = 15000

type AppointmentStatusOverride = {
  status: AppointmentStatus
  lastUpdatedBy?: "customer" | "business" | "system"
  lastStatusChangeAt?: string
  lastStatusChangeSource?:
    | "manual"
    | "confirm"
    | "system"
    | "auto_reminder_24h"
    | "automatic_24h_reminder"
  lastChangeType?: NonNullable<Appointment["lastChangeType"]>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function appointmentFallbackKey(a: Appointment): string {
  return [
    a.startsAt,
    a.clientName.trim().toLowerCase(),
    a.serviceLabel.trim().toLowerCase(),
    a.source ?? "unknown",
  ].join("|")
}

function dedupeAppointments(rows: Appointment[]): Appointment[] {
  const seenById = new Map<string, number>()
  const seenByFallback = new Map<string, number>()

  rows.forEach((a, idx) => {
    if (a.id && a.id.trim().length > 0) {
      seenById.set(a.id, idx)
      return
    }
    seenByFallback.set(appointmentFallbackKey(a), idx)
  })

  return rows.filter((a, idx) => {
    if (a.id && a.id.trim().length > 0) {
      return seenById.get(a.id) === idx
    }
    return seenByFallback.get(appointmentFallbackKey(a)) === idx
  })
}

function getStatusOverrides(): Record<string, AppointmentStatusOverride> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(APPOINTMENT_STATUS_OVERRIDES_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    if (!isObject(parsed)) return {}
    const output: Record<string, AppointmentStatusOverride> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (!isObject(value)) continue
      const status = value.status
      if (
        status !== "booked" &&
        status !== "pending" &&
        status !== "confirmed" &&
        status !== "cancelled" &&
        status !== "no_show" &&
        status !== "completed"
      ) {
        continue
      }
      const lastChangeType: AppointmentStatusOverride["lastChangeType"] =
        value.lastChangeType === "business_proposal_accepted" ||
        value.lastChangeType === "customer_request_accepted" ||
        value.lastChangeType === "customer_service_request_accepted" ||
        value.lastChangeType === "customer_request_rejected" ||
        value.lastChangeType === "reminder_24h_sent"
          ? value.lastChangeType
          : undefined
      output[id] = {
        status,
        lastUpdatedBy:
          value.lastUpdatedBy === "business" ||
          value.lastUpdatedBy === "customer" ||
          value.lastUpdatedBy === "system"
            ? value.lastUpdatedBy
            : undefined,
        lastStatusChangeAt:
          typeof value.lastStatusChangeAt === "string" ? value.lastStatusChangeAt : undefined,
        lastStatusChangeSource:
          value.lastStatusChangeSource === "manual" ||
          value.lastStatusChangeSource === "confirm" ||
          value.lastStatusChangeSource === "system" ||
          value.lastStatusChangeSource === "auto_reminder_24h" ||
          value.lastStatusChangeSource === "automatic_24h_reminder"
            ? value.lastStatusChangeSource
            : undefined,
        ...(lastChangeType ? { lastChangeType } : {}),
      }
    }
    return output
  } catch {
    return {}
  }
}

function saveStatusOverrides(overrides: Record<string, AppointmentStatusOverride>): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(APPOINTMENT_STATUS_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides))
}

function applyStatusOverrides(rows: Appointment[]): Appointment[] {
  const overrides = getStatusOverrides()
  return rows.map((row) => {
    if (row.id.startsWith(SB_BOOKING_PREFIX)) return row
    const override = overrides[row.id]
    if (!override) return row
    return {
      ...row,
      status: override.status,
      lastUpdatedBy: override.lastUpdatedBy ?? row.lastUpdatedBy,
      lastStatusChangeAt: override.lastStatusChangeAt ?? row.lastStatusChangeAt,
      lastStatusChangeSource: override.lastStatusChangeSource ?? row.lastStatusChangeSource,
      lastChangeType: override.lastChangeType ?? row.lastChangeType,
    }
  })
}

export type FetchMergedAppointmentsOptions = {
  businessId?: string | null
  force?: boolean
}

export async function fetchMergedAppointments(
  options: FetchMergedAppointmentsOptions = {},
): Promise<Appointment[]> {
  const cacheKey = mergedAppointmentsCacheKey(options.businessId)
  if (!options.force) {
    const cached = getCachedMergedAppointments(cacheKey)
    if (cached) return cached
  }

  const fromManual = getManualAppointments().map(mapManualToAppointment)
  let fromPublicBooks = getPublicBookings()
  let fromSupabase: Appointment[] = []
  /** Rekordy `ap-*` z mocków tylko gdy nie ma powiązanej firmy w Supabase (unikamy błędu delete unknown_appointment_id). */
  let seedAppointments: Appointment[] = initialAppointmentsList
  if (typeof window !== "undefined" && isSupabaseConfigured()) {
    const client = getBrowserClient()
    if (client) {
      const bid =
        options.businessId?.trim() || (await getCurrentBusinessProfileIdForClient(client))
      if (bid) {
        seedAppointments = []
        fromSupabase = await getBookingsForCurrentBusiness(client, bid)
        fromPublicBooks = fromPublicBooks.filter(
          (b) => normalizePublicSlug(b.businessSlug) === DEMO_BOOKING_SLUG
        )
      }
    }
  }
  const fromPublic = fromPublicBooks.map(mapPublicBookingToAppointment)
  const merged = dedupeAppointments([...seedAppointments, ...fromManual, ...fromSupabase, ...fromPublic]).sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )
  const withOverrides = applyStatusOverrides(merged)
  setCachedMergedAppointments(cacheKey, withOverrides)
  return withOverrides
}

export { invalidateMergedAppointmentsCache }

/** @deprecated Użyj fetchMergedAppointments - zostawione dla krótkich sync odświeżeń tylko lokalnych. */
export function getAllAppointments(): Appointment[] {
  const fromManual = getManualAppointments().map(mapManualToAppointment)
  const fromPublic = getPublicBookings().map(mapPublicBookingToAppointment)
  const merged = dedupeAppointments([...initialAppointmentsList, ...fromManual, ...fromPublic]).sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )
  return applyStatusOverrides(merged)
}

export function getAppointmentsForToday(
  rows: Appointment[],
  today: Date = getAppToday()
): Appointment[] {
  return rows.filter((a) => isSameAppDay(a.startsAt, today))
}

export function getNeedsContactAppointments(rows: Appointment[]): Appointment[] {
  return rows.filter((a) => appointmentRequiresBusinessContact(a))
}

export type AppointmentsStoreSnapshot = {
  appointments: Appointment[]
  ready: boolean
  loadError: boolean
}

export function useAppointmentsStore(businessId?: string | null): AppointmentsStoreSnapshot {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [ready, setReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    let debounceId: ReturnType<typeof setTimeout> | null = null
    let fallbackPollId: ReturnType<typeof setInterval> | null = null
    let cancelled = false

    const runSync = (force = false) => {
      void (async () => {
        try {
          const next = await fetchMergedAppointments({ businessId, force })
          if (cancelled) return
          setAppointments(next)
          setLoadError(false)
          setReady(true)
        } catch {
          if (cancelled) return
          setLoadError(true)
          setReady(true)
        }
      })()
    }

    const scheduleSync = (force = false) => {
      if (debounceId) clearTimeout(debounceId)
      debounceId = setTimeout(() => runSync(force), 120)
    }

    const cached = getCachedMergedAppointments(mergedAppointmentsCacheKey(businessId))
    if (cached) {
      queueMicrotask(() => {
        if (cancelled) return
        setAppointments(cached)
        setReady(true)
        setLoadError(false)
      })
    }

    if (isSupabaseConfigured() && !businessId?.trim()) {
      return () => {
        cancelled = true
        if (debounceId) clearTimeout(debounceId)
      }
    }

    runSync(Boolean(cached))

    const onBookings = () => scheduleSync(true)
    const onLocal = () => scheduleSync(true)
    window.addEventListener("pw-public-bookings", onLocal)
    window.addEventListener("pw-manual-appointments", onLocal)
    window.addEventListener("pw-appointments-overrides", onLocal)
    window.addEventListener("pw-bookings", onBookings)

    const bid = businessId?.trim()
    if (bid && isSupabaseConfigured()) {
      fallbackPollId = setInterval(() => scheduleSync(true), BOOKINGS_REALTIME_FALLBACK_POLL_MS)
    }

    return () => {
      cancelled = true
      if (debounceId) clearTimeout(debounceId)
      if (fallbackPollId) clearInterval(fallbackPollId)
      window.removeEventListener("pw-public-bookings", onLocal)
      window.removeEventListener("pw-manual-appointments", onLocal)
      window.removeEventListener("pw-appointments-overrides", onLocal)
      window.removeEventListener("pw-bookings", onBookings)
    }
  }, [businessId])

  return { appointments, ready, loadError }
}

type UpdateAppointmentStatusOptions = {
  lastUpdatedBy?: "customer" | "business" | "system"
  lastStatusChangeSource?: "manual" | "confirm" | "system" | "auto_reminder_24h" | "automatic_24h_reminder"
  lastChangeType?: NonNullable<Appointment["lastChangeType"]>
  reminderSentAtIso?: string | null
  reminderStatus?: string | null
  reminderDueAtIso?: string | null
}

function mapAppointmentStatusToPublicStatus(status: AppointmentStatus): PublicBookingStatus | null {
  if (
    status === "booked" ||
    status === "pending" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "no_show" ||
    status === "completed"
  ) {
    return status
  }
  return null
}

function mapAppointmentStatusToManualStatus(
  status: AppointmentStatus
):
  | "booked"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "completed"
  | "pending"
  | null {
  if (
    status === "booked" ||
    status === "pending" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "no_show" ||
    status === "completed"
  ) {
    return status
  }
  return null
}

function saveMockStatusOverride(
  appointmentId: string,
  status: AppointmentStatus,
  updatedAt: string,
  options: UpdateAppointmentStatusOptions
): void {
  const overrides = getStatusOverrides()
  const prev = overrides[appointmentId]
  overrides[appointmentId] = {
    ...prev,
    status,
    lastUpdatedBy: options.lastUpdatedBy ?? "business",
    lastStatusChangeAt: updatedAt,
    lastStatusChangeSource: options.lastStatusChangeSource ?? "manual",
    ...(options.lastChangeType !== undefined ? { lastChangeType: options.lastChangeType } : {}),
  }
  saveStatusOverrides(overrides)
  window.dispatchEvent(new Event("pw-appointments-overrides"))
}

/**
 * Jedno miejsce do ręcznej zmiany statusu wizyty (online/manual/mock fallback).
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  options: UpdateAppointmentStatusOptions = {}
): Promise<boolean> {
  if (typeof window === "undefined") return false

  const rawSb = unwrapSupabaseBookingAppointmentId(appointmentId)
  if (rawSb) {
    const client = getBrowserClient()
    if (!client) return false
    const bid = await getCurrentBusinessProfileIdForClient(client)
    if (!bid) return false
    const r = await updateBookingStatus(client, bid, rawSb, status, {
      lastUpdatedBy: options.lastUpdatedBy,
      lastStatusChangeSource: options.lastStatusChangeSource,
      lastChangeType: options.lastChangeType,
      reminderSentAtIso: options.reminderSentAtIso,
      reminderStatus: options.reminderStatus,
      reminderDueAtIso: options.reminderDueAtIso,
    })
    if (r.ok) {
      // Bez tego lista i statystyki czytałyby stary status z cache aż do
      // następnego pollingu. Wymuszamy natychmiastowe odświeżenie obu widoków.
      invalidateMergedAppointmentsCache()
      window.dispatchEvent(new Event("pw-bookings"))
      // Po oznaczeniu „nieobecność klienta” wysyłamy follow-up (tylko gdy firma
      // ma włączony szablon `no_show_follow_up`). Fire-and-forget — nie blokuje UI.
      if (status === "no_show") {
        void fetch("/api/bookings/notify-no-show", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: appointmentId }),
          keepalive: true,
        }).catch(() => {})
      }
      // Własne szablony typu „zdarzenie" dla zmian statusu z panelu (created jest
      // wysyłane na ścieżce rezerwacji). Fire-and-forget; dedup chroni przed dublami.
      if (
        status === "confirmed" ||
        status === "cancelled" ||
        status === "no_show" ||
        status === "completed"
      ) {
        void fetch("/api/bookings/notify-status-change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: appointmentId, status }),
          keepalive: true,
        }).catch(() => {})
      }
    }
    return r.ok
  }

  const updatedAt = new Date().toISOString()
  const patchMeta: {
    lastUpdatedBy: "customer" | "business" | "system"
    lastStatusChangeAt: string
    lastStatusChangeSource:
      | "manual"
      | "confirm"
      | "system"
      | "auto_reminder_24h"
      | "automatic_24h_reminder"
    updatedAt: string
    lastChangeType?: NonNullable<Appointment["lastChangeType"]>
  } = {
    lastUpdatedBy: options.lastUpdatedBy ?? "business",
    lastStatusChangeAt: updatedAt,
    lastStatusChangeSource: options.lastStatusChangeSource ?? "manual",
    updatedAt,
  }
  if (options.lastChangeType !== undefined) {
    patchMeta.lastChangeType = options.lastChangeType
  }

  const publicId = unwrapPublicAppointmentId(appointmentId)
  if (publicId) {
    const publicStatus = mapAppointmentStatusToPublicStatus(status)
    if (!publicStatus) return false
    return updatePublicBooking(publicId, {
      status: publicStatus,
      ...patchMeta,
    })
  }

  const manualId = unwrapManualAppointmentId(appointmentId)
  if (manualId) {
    const manualStatus = mapAppointmentStatusToManualStatus(status)
    if (!manualStatus) return false
    return updateManualAppointment(manualId, {
      status: manualStatus,
      ...patchMeta,
    })
  }

  saveMockStatusOverride(appointmentId, status, updatedAt, patchMeta)
  return true
}

