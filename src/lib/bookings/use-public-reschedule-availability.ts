"use client"

import * as React from "react"

import { findFirstSelectableDateKey, parseLocalDateKey, useClientToday } from "@/components/booking/public-booking-calendar"
import {
  buildEffectiveAvailabilityDaysForDate,
  indexExceptionsByDate,
  pickServiceRuleForWeekday,
  resolveBookingException,
  type AvailabilityExceptionRecord,
  type ServiceAvailabilityRuleRecord,
} from "@/lib/booking/effective-availability"
import { applyStaffAvailabilityToDays } from "@/lib/booking/staff-day-overlay"
import { getAvailabilityForBusinessSlug, getServiceAvailabilityForBusinessSlug } from "@/lib/availability/availability-store"
import { resolveServiceBreakMinutes } from "@/lib/bookings/break-minutes"
import {
  applyRescheduleSelfExcludeToBlockedKeys,
  fetchBookedSlotsForPublicSlug,
  toBlockedSlotKeySetForStaff,
  type BookedAppointmentSlot,
} from "@/lib/bookings/slot-availability"
import { toLocalDateKey } from "@/lib/booking/availability-slots"
import { getActiveServicesForBusinessSlug } from "@/lib/services/services-store"
import {
  getStaffAvailabilityForPublicSlug,
  type StaffAvailabilityExceptionRecord,
  type StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"
import { DEMO_BOOKING_SLUG, normalizePublicSlug } from "@/lib/business/slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { AvailabilityDay, Service } from "@/types/domain"

export type PublicRescheduleAvailabilityInput = {
  businessSlug: string
  serviceId: string | null | undefined
  staffId: string | null | undefined
  bookingId: string
  currentDate: string
  currentTime: string
  serviceDurationMinutes: number
  serviceBreakMinutes?: number | null
}

export function usePublicRescheduleAvailability(input: PublicRescheduleAvailabilityInput) {
  const clientToday = useClientToday()
  const normalizedSlug = React.useMemo(
    () => normalizePublicSlug(input.businessSlug),
    [input.businessSlug],
  )

  const [service, setService] = React.useState<Service | null>(null)
  const [bookingAvailability, setBookingAvailability] = React.useState<AvailabilityDay[]>([])
  const [availabilityStrict, setAvailabilityStrict] = React.useState(false)
  const [availabilityReady, setAvailabilityReady] = React.useState(false)
  const [availabilityLoadFailed, setAvailabilityLoadFailed] = React.useState(false)
  const [publicBookedRows, setPublicBookedRows] = React.useState<BookedAppointmentSlot[]>([])
  const [staffAvail, setStaffAvail] = React.useState<{
    rules: StaffAvailabilityRuleInput[]
    exceptions: StaffAvailabilityExceptionRecord[]
  } | null>(null)
  const [staffAvailReady, setStaffAvailReady] = React.useState(false)
  const [availabilityExceptions, setAvailabilityExceptions] = React.useState<AvailabilityExceptionRecord[]>([])
  const [serviceAvailabilityRules, setServiceAvailabilityRules] = React.useState<ServiceAvailabilityRuleRecord[]>([])
  const [dayOverride, setDayOverride] = React.useState<string | null>(null)
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null)

  const breakMinutes = React.useMemo(
    () => resolveServiceBreakMinutes(input.serviceBreakMinutes ?? service?.breakMinutes),
    [input.serviceBreakMinutes, service?.breakMinutes],
  )

  const durationMinutes = React.useMemo(
    () => Math.max(1, service?.durationMinutes ?? input.serviceDurationMinutes ?? 60),
    [service?.durationMinutes, input.serviceDurationMinutes],
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const client = getBrowserClient()
      const svcRes = await getActiveServicesForBusinessSlug(client, normalizedSlug)
      if (cancelled) return
      const match =
        input.serviceId != null
          ? svcRes.services.find((s) => s.id === input.serviceId) ?? null
          : svcRes.services.find((s) => s.name === input.serviceId) ?? svcRes.services[0] ?? null
      setService(match)
    })()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, input.serviceId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const client = getBrowserClient()
      const res = await getAvailabilityForBusinessSlug(client, normalizedSlug)
      if (cancelled) return
      setBookingAvailability(res.days)
      setAvailabilityStrict(res.strict)
      setAvailabilityLoadFailed(res.loadFailed)
      setAvailabilityReady(true)
      setDayOverride(null)
      setSelectedTime(null)
    })()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!clientToday || !isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG) {
        if (!cancelled) setPublicBookedRows([])
        return
      }
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) setPublicBookedRows([])
        return
      }
      const from = toLocalDateKey(clientToday)
      const end = new Date(clientToday)
      end.setDate(end.getDate() + 120)
      const to = toLocalDateKey(end)
      const rows = await fetchBookedSlotsForPublicSlug(client, normalizedSlug, from, to)
      if (!cancelled) setPublicBookedRows(rows)
    })()
    const onBookings = () => {
      void (async () => {
        const client = getBrowserClient()
        if (!client || !clientToday) return
        const from = toLocalDateKey(clientToday)
        const end = new Date(clientToday)
        end.setDate(end.getDate() + 120)
        const to = toLocalDateKey(end)
        const rows = await fetchBookedSlotsForPublicSlug(client, normalizedSlug, from, to)
        setPublicBookedRows(rows)
      })()
    }
    window.addEventListener("pw-bookings", onBookings)
    return () => {
      cancelled = true
      window.removeEventListener("pw-bookings", onBookings)
    }
  }, [normalizedSlug, clientToday])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const staffId = input.staffId?.trim()
      if (!staffId || !isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG) {
        if (!cancelled) {
          setStaffAvail(null)
          setStaffAvailReady(true)
        }
        return
      }
      setStaffAvailReady(false)
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) {
          setStaffAvail(null)
          setStaffAvailReady(true)
        }
        return
      }
      const ctx = await getStaffAvailabilityForPublicSlug(client, normalizedSlug, staffId)
      if (!cancelled) {
        setStaffAvail({ rules: ctx.rules, exceptions: ctx.exceptions })
        setStaffAvailReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, input.staffId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!clientToday || !isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG) {
        if (!cancelled) {
          setAvailabilityExceptions([])
          setServiceAvailabilityRules([])
        }
        return
      }
      const client = getBrowserClient()
      if (!client) return
      const from = toLocalDateKey(clientToday)
      const end = new Date(clientToday)
      end.setDate(end.getDate() + 120)
      const to = toLocalDateKey(end)
      const ctx = await getServiceAvailabilityForBusinessSlug(
        client,
        normalizedSlug,
        service?.id ?? input.serviceId ?? null,
        from,
        to,
      )
      if (cancelled) return
      setAvailabilityExceptions(ctx.exceptions)
      setServiceAvailabilityRules(ctx.serviceRules)
    })()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, service?.id, input.serviceId, clientToday])

  const exceptionByDate = React.useMemo(
    () => indexExceptionsByDate(availabilityExceptions),
    [availabilityExceptions],
  )

  const resolveAvailabilityDaysForDate = React.useCallback(
    (d: Date) => {
      const key = toLocalDateKey(d)
      const exc = resolveBookingException(exceptionByDate.get(key), d)
      const usesDefault = service?.usesDefaultAvailability !== false
      const rule = pickServiceRuleForWeekday(serviceAvailabilityRules, d.getDay())
      let days = buildEffectiveAvailabilityDaysForDate(
        bookingAvailability,
        d,
        exc,
        usesDefault,
        rule,
      )
      const staffId = input.staffId?.trim()
      if (staffId && staffAvail) {
        days = applyStaffAvailabilityToDays(days, d, staffAvail.rules, staffAvail.exceptions)
      } else if (staffId && !staffAvail) {
        const wd = d.getDay()
        days = days.map((day) =>
          day.weekday === wd
            ? { ...day, isOpen: false, breakStart: undefined, breakEnd: undefined }
            : day,
        )
      }
      return days
    },
    [
      bookingAvailability,
      exceptionByDate,
      service?.usesDefaultAvailability,
      serviceAvailabilityRules,
      input.staffId,
      staffAvail,
    ],
  )

  const effectiveBlockedSlotKeys = React.useMemo(() => {
    const derived = toBlockedSlotKeySetForStaff(
      publicBookedRows,
      input.staffId?.trim() ?? null,
      durationMinutes,
      breakMinutes,
    )
    const selfRow: BookedAppointmentSlot = {
      appointment_date: input.currentDate,
      appointment_time: input.currentTime,
      status: "confirmed",
      staff_id: input.staffId?.trim() ?? null,
      service_duration_minutes: durationMinutes,
      service_break_minutes: breakMinutes,
    }
    return applyRescheduleSelfExcludeToBlockedKeys(
      derived,
      selfRow,
      durationMinutes,
      breakMinutes,
      input.staffId?.trim() ?? null,
    )
  }, [
    publicBookedRows,
    input.staffId,
    input.currentDate,
    input.currentTime,
    durationMinutes,
    breakMinutes,
  ])

  const defaultDayKey = React.useMemo(() => {
    if (!clientToday || !availabilityReady) return null
    return findFirstSelectableDateKey(clientToday, {
      availability: bookingAvailability,
      availabilityStrict,
      serviceDurationMinutes: durationMinutes,
      asOfTime: clientToday,
      blockedSlotKeys: effectiveBlockedSlotKeys,
      resolveAvailabilityDaysForDate,
    })
  }, [
    clientToday,
    bookingAvailability,
    availabilityStrict,
    availabilityReady,
    effectiveBlockedSlotKeys,
    resolveAvailabilityDaysForDate,
    durationMinutes,
  ])

  const selectedDayKey = dayOverride ?? defaultDayKey

  return {
    clientToday,
    service,
    availabilityReady,
    availabilityLoadFailed,
    availabilityStrict,
    bookingAvailability,
    durationMinutes,
    breakMinutes,
    effectiveBlockedSlotKeys,
    resolveAvailabilityDaysForDate,
    selectedDayKey,
    dayOverride,
    setDayOverride,
    selectedTime,
    setSelectedTime,
    staffAvailReady,
    blockCalendarForNoStaff:
      isSupabaseConfigured() &&
      normalizedSlug !== DEMO_BOOKING_SLUG &&
      Boolean(input.staffId?.trim()) &&
      staffAvailReady &&
      staffAvail === null,
  }
}

export { parseLocalDateKey }
