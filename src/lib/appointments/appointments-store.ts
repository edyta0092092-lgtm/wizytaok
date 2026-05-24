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

export async function fetchMergedAppointments(): Promise<Appointment[]> {
  const fromManual = getManualAppointments().map(mapManualToAppointment)
  let fromPublicBooks = getPublicBookings()
  let fromSupabase: Appointment[] = []
  /** Rekordy `ap-*` z mocków tylko gdy nie ma powiązanej firmy w Supabase (unikamy błędu delete unknown_appointment_id). */
  let seedAppointments: Appointment[] = initialAppointmentsList
  if (typeof window !== "undefined" && isSupabaseConfigured()) {
    const client = getBrowserClient()
    if (client) {
      const bid = await getCurrentBusinessProfileIdForClient(client)
      if (bid) {
        seedAppointments = []
        fromSupabase = await getBookingsForCurrentBusiness(client)
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
  return applyStatusOverrides(merged)
}

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

export function useAppointmentsStore(): AppointmentsStoreSnapshot {
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [ready, setReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)

  React.useEffect(() => {
    const sync = () => {
      void (async () => {
        try {
          const next = await fetchMergedAppointments()
          queueMicrotask(() => {
            setAppointments(next)
            setLoadError(false)
            setReady(true)
          })
        } catch {
          queueMicrotask(() => {
            setLoadError(true)
            setReady(true)
          })
        }
      })()
    }
    sync()
    window.addEventListener("pw-public-bookings", sync)
    window.addEventListener("pw-manual-appointments", sync)
    window.addEventListener("pw-appointments-overrides", sync)
    window.addEventListener("pw-bookings", sync)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener("pw-public-bookings", sync)
      window.removeEventListener("pw-manual-appointments", sync)
      window.removeEventListener("pw-appointments-overrides", sync)
      window.removeEventListener("pw-bookings", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

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

