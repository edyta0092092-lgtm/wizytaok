"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  PublicBookingCalendar,
  findFirstSelectableDateKey,
  parseLocalDateKey,
  useClientToday,
} from "@/components/booking/public-booking-calendar"

import { getSlotsForSelectedDate, toLocalDateKey } from "@/lib/booking/availability-slots"
import {
  buildEffectiveAvailabilityDaysForDate,
  emptySlotsReason,
  indexExceptionsByDate,
  pickServiceRuleForWeekday,
  resolveBookingException,
  type AvailabilityExceptionRecord,
  type ServiceAvailabilityRuleRecord,
} from "@/lib/booking/effective-availability"
import {
  getAvailabilityForBusinessSlug,
  getServiceAvailabilityForBusinessSlug,
} from "@/lib/availability/availability-store"
import { createOnlineBooking } from "@/lib/bookings/bookings-store"
import { notifyBookingCreatedAfterOnlineBooking } from "@/lib/bookings/notify-booking-created-action"
import {
  fetchBookedSlotsForPublicSlug,
  toBlockedSlotKeySetForStaff,
  blockedSlotKey,
  type BookedAppointmentSlot,
} from "@/lib/bookings/slot-availability"
import {
  findFirstDateKeyWithMergedStaffSlots,
  mergeSlotsForAnyAssignedStaff,
} from "@/lib/bookings/public-booking-staff-slots"
import {
  MANUAL_BOOKING_ANY_STAFF,
  resolveManualBookingStaffSelection,
} from "@/lib/bookings/manual-booking-staff"
import { applyStaffAvailabilityToDays } from "@/lib/booking/staff-day-overlay"
import { savePublicBooking, type PublicBooking } from "@/lib/bookings/public-bookings"
import { resolvePublicBookingBusinessProfile } from "@/lib/business/public-booking-slug"
import {
  DEMO_BOOKING_SLUG,
  normalizePublicSlug,
} from "@/lib/business/slug"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import {
  buildStoredInternationalPhone,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"
import { BRAND } from "@/config/brand"
import { getActiveServicesForBusinessSlug } from "@/lib/services/services-store"
import type { AvailabilityDay, Service } from "@/types/domain"
import type { StaffMember } from "@/types/domain"

import { getServiceStaffForPublicSlug } from "@/lib/staff/staff-store"
import {
  getStaffAvailabilityForPublicSlug,
  type StaffAvailabilityExceptionRecord,
  type StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"

type BookingForm = {
  firstName: string
  lastName: string
  phoneDialCode: string
  phoneNational: string
  email: string
  note: string
}

function joinPersonName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim().replace(/\s+/g, " ")
}

export default function PublicBookingPage() {
  const { t, language } = useTranslations()
  const router = useRouter()
  const params = useParams<{ businessSlug: string }>()
  const businessSlug = params.businessSlug

  const [form, setForm] = React.useState<BookingForm>({
    firstName: "",
    lastName: "",
    phoneDialCode: "+48",
    phoneNational: "",
    email: "",
    note: "",
  })
  const clientToday = useClientToday()

  const [catalog, setCatalog] = React.useState<Service[]>([])
  const [servicesLoadFailed, setServicesLoadFailed] = React.useState(false)
  /** Ustalone po `getActiveServicesForBusinessSlug`; anon nie widzi SELECT na business_profiles bez RPC. */
  const [bookingServicesBusinessFound, setBookingServicesBusinessFound] = React.useState(true)
  const [servicesLoadDiagnostics, setServicesLoadDiagnostics] = React.useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | null>(null)
  const [serviceStaff, setServiceStaff] = React.useState<StaffMember[]>([])
  const [selectedStaffId, setSelectedStaffId] = React.useState<string | null>(null)
  const [staffRules, setStaffRules] = React.useState<StaffAvailabilityRuleInput[]>([])
  const [staffExceptions, setStaffExceptions] = React.useState<StaffAvailabilityExceptionRecord[]>([])
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [businessTitle, setBusinessTitle] = React.useState<string | null>(null)
  const [businessNotFound, setBusinessNotFound] = React.useState(false)

  const [bookingAvailability, setBookingAvailability] = React.useState<AvailabilityDay[]>([])
  const [availabilityStrict, setAvailabilityStrict] = React.useState(false)
  const [availabilityLoadFailed, setAvailabilityLoadFailed] = React.useState(false)
  const [availabilityNotConfigured, setAvailabilityNotConfigured] = React.useState(false)
  const [availabilityReady, setAvailabilityReady] = React.useState(false)
  const [dayOverride, setDayOverride] = React.useState<string | null>(null)
  const [blockedSlotKeys, setBlockedSlotKeys] = React.useState<ReadonlySet<string>>(() => new Set())
  const [publicBookedRows, setPublicBookedRows] = React.useState<BookedAppointmentSlot[]>([])
  const [staffAvailById, setStaffAvailById] = React.useState<
    Record<
      string,
      { rules: StaffAvailabilityRuleInput[]; exceptions: StaffAvailabilityExceptionRecord[] }
    >
  >({})
  const [businessProfileIdForSlug, setBusinessProfileIdForSlug] = React.useState<string | null>(null)
  const [availabilityExceptions, setAvailabilityExceptions] = React.useState<
    AvailabilityExceptionRecord[]
  >([])
  const [serviceAvailabilityRules, setServiceAvailabilityRules] = React.useState<
    ServiceAvailabilityRuleRecord[]
  >([])

  const normalizedSlug = React.useMemo(
    () => normalizePublicSlug(decodeURIComponent(String(businessSlug))),
    [businessSlug]
  )

  React.useEffect(() => {
    const defaultTitle = BRAND.name

    if (!isSupabaseConfigured()) {
      queueMicrotask(() => {
        setBusinessTitle(defaultTitle)
        setBusinessNotFound(false)
        setBusinessProfileIdForSlug(null)
      })
      return
    }

    if (normalizedSlug === DEMO_BOOKING_SLUG) {
      queueMicrotask(() => {
        setBusinessTitle(defaultTitle)
        setBusinessNotFound(false)
        setBusinessProfileIdForSlug(null)
      })
      return
    }

    const client = getBrowserClient()
    if (!client) {
      queueMicrotask(() => {
        setBusinessTitle(defaultTitle)
        setBusinessNotFound(false)
        setBusinessProfileIdForSlug(null)
      })
      return
    }

    let cancelled = false
    void resolvePublicBookingBusinessProfile(client, normalizedSlug).then((r) => {
      if (cancelled) return
      if (r.businessId) {
        setBusinessProfileIdForSlug(r.businessId)
        setBusinessTitle((r.businessName && r.businessName.trim()) || defaultTitle)
        setBusinessNotFound(false)
        return
      }
      setBusinessProfileIdForSlug(null)
      setBusinessNotFound(true)
      setBusinessTitle(null)
    })
    return () => {
      cancelled = true
    }
  }, [normalizedSlug])

  React.useEffect(() => {
    let cancelled = false
    const load = () => {
      void (async () => {
        const client = getBrowserClient()
        const svcRes = await getActiveServicesForBusinessSlug(client, normalizedSlug)
        if (cancelled) return
        const { services: active, loadFailed, businessFound, loadDiagnostics, loadSource } = svcRes
        setServicesLoadFailed(loadFailed)
        setBookingServicesBusinessFound(businessFound)
        setServicesLoadDiagnostics(
          process.env.NODE_ENV === "development" && loadFailed ? (loadDiagnostics ?? null) : null
        )
        if (process.env.NODE_ENV === "development") {
          console.info("[book/catalog]", {
            slug: normalizedSlug,
            loadSource,
            count: active.length,
            loadFailed,
          })
        }
        setCatalog(active)
        setSelectedServiceId((prev) => {
          if (prev && active.some((s) => s.id === prev)) return prev
          return null
        })
      })()
    }
    load()
    const onPw = () => load()
    window.addEventListener("pw-services", onPw)
    return () => {
      cancelled = true
      window.removeEventListener("pw-services", onPw)
    }
  }, [normalizedSlug])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG) {
        const res = await getAvailabilityForBusinessSlug(null, normalizedSlug)
        if (cancelled) return
        setBookingAvailability(res.days)
        setAvailabilityStrict(res.strict)
        setAvailabilityLoadFailed(res.loadFailed)
        setAvailabilityNotConfigured(res.notConfigured)
        setAvailabilityReady(true)
        queueMicrotask(() => {
          setDayOverride(null)
        })
        return
      }
      setAvailabilityReady(false)
      const client = getBrowserClient()
      const res = await getAvailabilityForBusinessSlug(client, normalizedSlug)
      if (cancelled) return
      setBookingAvailability(res.days)
      setAvailabilityStrict(res.strict)
      setAvailabilityLoadFailed(res.loadFailed)
      setAvailabilityNotConfigured(res.notConfigured)
      setAvailabilityReady(true)
      queueMicrotask(() => {
        setDayOverride(null)
      })
    }
    void run()
    const onA = () => {
      void run()
    }
    window.addEventListener("pw-availability", onA)
    return () => {
      cancelled = true
      window.removeEventListener("pw-availability", onA)
    }
  }, [normalizedSlug])

  React.useEffect(() => {
    let cancelled = false
    const loadBlocked = async () => {
      if (!isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG || !clientToday) {
        if (!cancelled) {
          setPublicBookedRows([])
          setBlockedSlotKeys(new Set())
        }
        return
      }
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) {
          setPublicBookedRows([])
          setBlockedSlotKeys(new Set())
        }
        return
      }
      const from = toLocalDateKey(clientToday)
      const end = new Date(clientToday)
      end.setDate(end.getDate() + 120)
      const to = toLocalDateKey(end)
      const rows = await fetchBookedSlotsForPublicSlug(client, normalizedSlug, from, to)
      if (!cancelled) {
        setPublicBookedRows(rows)
        const selectedDuration = Math.max(
          1,
          catalog.find((s) => s.id === selectedServiceId)?.durationMinutes ?? 0
        )
        setBlockedSlotKeys(toBlockedSlotKeySetForStaff(rows, selectedStaffId, selectedDuration))
      }
    }
    void loadBlocked()
    const onBookings = () => {
      void loadBlocked()
    }
    window.addEventListener("pw-bookings", onBookings)
    return () => {
      cancelled = true
      window.removeEventListener("pw-bookings", onBookings)
    }
  }, [normalizedSlug, clientToday, selectedStaffId, selectedServiceId, catalog])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      const client = getBrowserClient()
      const selectedService = catalog.find((s) => s.id === selectedServiceId) ?? null
      /** Zawsze UUID z wiersza services (katalog), nie indeks/slug/nazwa. */
      const serviceUuid = selectedService?.id ?? null
      if (process.env.NODE_ENV === "development" && serviceUuid) {
        console.info("[book.selectedService]", {
          selectedServiceId,
          id: selectedService?.id,
          name: selectedService?.name,
          businessId: businessProfileIdForSlug,
        })
      }
      const { staff, businessId, rpcStaff, rpcError } = await getServiceStaffForPublicSlug(
        client,
        normalizedSlug,
        serviceUuid
      )
      console.info("[book.staff.rpc]", {
        businessId,
        serviceId: serviceUuid,
        serviceName: selectedService?.name,
        staff: rpcStaff,
        error: rpcError,
      })
      if (cancelled) return
      setServiceStaff(staff)
      setSelectedStaffId((prev) => {
        if (staff.length === 1) return staff[0]?.id ?? null
        if (prev && staff.some((x) => x.id === prev)) return prev
        return null
      })
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, selectedServiceId, catalog, businessProfileIdForSlug])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG || serviceStaff.length === 0) {
        if (!cancelled) setStaffAvailById({})
        return
      }
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) setStaffAvailById({})
        return
      }
      const entries = await Promise.all(
        serviceStaff.map(async (m) => {
          const ctx = await getStaffAvailabilityForPublicSlug(client, normalizedSlug, m.id)
          return [m.id, ctx] as const
        }),
      )
      if (cancelled) return
      const next: Record<
        string,
        { rules: StaffAvailabilityRuleInput[]; exceptions: StaffAvailabilityExceptionRecord[] }
      > = {}
      for (const [id, ctx] of entries) {
        next[id] = { rules: ctx.rules, exceptions: ctx.exceptions }
      }
      setStaffAvailById(next)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, serviceStaff])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      const client = getBrowserClient()
      const ctx = await getStaffAvailabilityForPublicSlug(client, normalizedSlug, selectedStaffId)
      if (cancelled) return
      setStaffRules(ctx.rules)
      setStaffExceptions(ctx.exceptions)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, selectedStaffId])

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!clientToday || !isSupabaseConfigured() || normalizedSlug === DEMO_BOOKING_SLUG) {
        if (!cancelled) {
          setAvailabilityExceptions([])
          setServiceAvailabilityRules([])
        }
        return
      }
      const client = getBrowserClient()
      if (!client) {
        if (!cancelled) {
          setAvailabilityExceptions([])
          setServiceAvailabilityRules([])
        }
        return
      }
      const from = toLocalDateKey(clientToday)
      const end = new Date(clientToday)
      end.setDate(end.getDate() + 120)
      const to = toLocalDateKey(end)
      const ctx = await getServiceAvailabilityForBusinessSlug(
        client,
        normalizedSlug,
        selectedServiceId,
        from,
        to
      )
      if (cancelled) return
      setAvailabilityExceptions(ctx.exceptions)
      setServiceAvailabilityRules(ctx.serviceRules)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [normalizedSlug, selectedServiceId, clientToday])

  const exceptionByDate = React.useMemo(
    () => indexExceptionsByDate(availabilityExceptions),
    [availabilityExceptions]
  )

  const selectedService = React.useMemo(
    () => catalog.find((s) => s.id === selectedServiceId) ?? null,
    [catalog, selectedServiceId]
  )

  /** Supabase: bez przypisanego staffu nie pokazuj kalendarza (terminy bez sensu). */
  const blockCalendarForNoStaff = React.useMemo(
    () =>
      isSupabaseConfigured() &&
      normalizedSlug !== DEMO_BOOKING_SLUG &&
      Boolean(selectedServiceId) &&
      serviceStaff.length === 0,
    [normalizedSlug, selectedServiceId, serviceStaff.length],
  )

  const resolveBaseDaysForDate = React.useCallback(
    (d: Date) => {
      const key = toLocalDateKey(d)
      const exc = resolveBookingException(exceptionByDate.get(key), d)
      const svc = catalog.find((s) => s.id === selectedServiceId) ?? null
      const usesDefault = svc?.usesDefaultAvailability !== false
      const rule = pickServiceRuleForWeekday(serviceAvailabilityRules, d.getDay())
      return buildEffectiveAvailabilityDaysForDate(
        bookingAvailability,
        d,
        exc,
        usesDefault,
        rule,
      )
    },
    [bookingAvailability, catalog, exceptionByDate, selectedServiceId, serviceAvailabilityRules],
  )

  const resolveAvailabilityDaysForDate = React.useCallback(
    (d: Date) => {
      const days = resolveBaseDaysForDate(d)
      if (!selectedStaffId) return days
      return applyStaffAvailabilityToDays(days, d, staffRules, staffExceptions)
    },
    [resolveBaseDaysForDate, selectedStaffId, staffRules, staffExceptions],
  )

  const resolveDaysForServiceStaffMember = React.useCallback(
    (staffMemberId: string, d: Date) => {
      const days = resolveBaseDaysForDate(d)
      const ctx = staffAvailById[staffMemberId]
      return applyStaffAvailabilityToDays(days, d, ctx?.rules ?? [], ctx?.exceptions ?? [])
    },
    [resolveBaseDaysForDate, staffAvailById],
  )

  const useMergedAnyStaffSlots = Boolean(
    selectedService &&
      serviceStaff.length > 1 &&
      !selectedStaffId &&
      isSupabaseConfigured() &&
      normalizedSlug !== DEMO_BOOKING_SLUG,
  )

  const customSlotsForDate = React.useCallback(
    (d: Date): string[] | null => {
      if (!selectedService || !clientToday || !useMergedAnyStaffSlots) return null
      return mergeSlotsForAnyAssignedStaff(
        d,
        clientToday,
        clientToday,
        selectedService.durationMinutes,
        serviceStaff,
        resolveDaysForServiceStaffMember,
        publicBookedRows,
      )
    },
    [
      selectedService,
      clientToday,
      useMergedAnyStaffSlots,
      serviceStaff,
      resolveDaysForServiceStaffMember,
      publicBookedRows,
    ],
  )

  const effectiveBlockedSlotKeys = React.useMemo(() => {
    const duration = Math.max(1, selectedService?.durationMinutes ?? 60)
    const derived = toBlockedSlotKeySetForStaff(publicBookedRows, selectedStaffId, duration)
    if (blockedSlotKeys.size === 0) return derived
    const merged = new Set<string>(blockedSlotKeys)
    for (const k of derived) merged.add(k)
    return merged
  }, [blockedSlotKeys, publicBookedRows, selectedStaffId, selectedService?.durationMinutes])

  const defaultDayKey = React.useMemo(() => {
    if (!clientToday || !availabilityReady) return null
    const svc = catalog.find((s) => s.id === selectedServiceId)
    const duration = svc?.durationMinutes ?? 60
    if (useMergedAnyStaffSlots && svc) {
      const first = findFirstDateKeyWithMergedStaffSlots(
        clientToday,
        clientToday,
        duration,
        serviceStaff,
        resolveDaysForServiceStaffMember,
        publicBookedRows,
      )
      if (first) return first
    }
    return findFirstSelectableDateKey(clientToday, {
      availability: bookingAvailability,
      availabilityStrict,
      serviceDurationMinutes: duration,
      asOfTime: clientToday,
      blockedSlotKeys: effectiveBlockedSlotKeys,
      resolveAvailabilityDaysForDate,
    })
  }, [
    clientToday,
    selectedServiceId,
    catalog,
    bookingAvailability,
    availabilityStrict,
    availabilityReady,
    effectiveBlockedSlotKeys,
    resolveAvailabilityDaysForDate,
    serviceStaff,
    useMergedAnyStaffSlots,
    resolveDaysForServiceStaffMember,
    publicBookedRows,
  ])

  const selectedDayKey = dayOverride ?? defaultDayKey

  const availableStaffForSelectedSlot = React.useMemo(() => {
    if (!selectedService || !clientToday || !selectedDayKey || !selectedTime || serviceStaff.length === 0) {
      return serviceStaff
    }
    const d = parseLocalDateKey(selectedDayKey)
    return serviceStaff.filter((member) => {
      const days = resolveDaysForServiceStaffMember(member.id, d)
      const staffBlocked = toBlockedSlotKeySetForStaff(
        publicBookedRows,
        member.id,
        Math.max(1, selectedService.durationMinutes)
      )
      const slots = getSlotsForSelectedDate(
        d,
        clientToday,
        clientToday,
        Math.max(1, selectedService.durationMinutes),
        days,
        staffBlocked,
      )
      return slots.includes(selectedTime)
    })
  }, [
    selectedService,
    clientToday,
    selectedDayKey,
    selectedTime,
    serviceStaff,
    resolveDaysForServiceStaffMember,
    publicBookedRows,
  ])

  React.useEffect(() => {
    if (serviceStaff.length === 0) {
      queueMicrotask(() => setSelectedStaffId(null))
      return
    }
    if (serviceStaff.length === 1) {
      if (selectedStaffId !== serviceStaff[0]?.id) {
        queueMicrotask(() => setSelectedStaffId(serviceStaff[0]?.id ?? null))
      }
      return
    }
    const availableIds = new Set(availableStaffForSelectedSlot.map((x) => x.id))
    if (selectedStaffId && !availableIds.has(selectedStaffId)) {
      if (availableStaffForSelectedSlot.length === 1) {
        queueMicrotask(() =>
          setSelectedStaffId(availableStaffForSelectedSlot[0]?.id ?? null),
        )
      } else {
        queueMicrotask(() => setSelectedStaffId(null))
      }
      return
    }
    if (!selectedStaffId && availableStaffForSelectedSlot.length === 1) {
      queueMicrotask(() =>
        setSelectedStaffId(availableStaffForSelectedSlot[0]?.id ?? null),
      )
    }
  }, [serviceStaff, selectedStaffId, availableStaffForSelectedSlot])

  React.useEffect(() => {
    if (!selectedDayKey || !selectedTime) return
    if (effectiveBlockedSlotKeys.has(blockedSlotKey(selectedDayKey, selectedTime))) {
      queueMicrotask(() => {
        setSelectedTime(null)
      })
    }
  }, [effectiveBlockedSlotKeys, selectedDayKey, selectedTime])

  const useAvailSlots =
    (availabilityStrict ||
      (Array.isArray(bookingAvailability) && bookingAvailability.length > 0)) &&
    (selectedService?.durationMinutes ?? 0) > 0

  const slotEmptyDetail = React.useMemo<"closed" | "service" | null>(() => {
    if (!useAvailSlots || !selectedDayKey || !clientToday || !selectedService) return null
    const d = parseLocalDateKey(selectedDayKey)
    const exc = resolveBookingException(exceptionByDate.get(selectedDayKey), d)
    const usesDefault = selectedService.usesDefaultAvailability !== false
    const rule = pickServiceRuleForWeekday(serviceAvailabilityRules, d.getDay())
    const dayModel = buildEffectiveAvailabilityDaysForDate(
      bookingAvailability,
      d,
      exc,
      usesDefault,
      rule
    )
    const slots = getSlotsForSelectedDate(
      d,
      clientToday,
      clientToday,
      Math.max(1, selectedService.durationMinutes),
      dayModel,
      effectiveBlockedSlotKeys
    )
    const reason = emptySlotsReason(
      bookingAvailability,
      d,
      exc,
      usesDefault,
      rule,
      slots.length
    )
    return reason === "closed" || reason === "service" ? reason : null
  }, [
    useAvailSlots,
    selectedDayKey,
    clientToday,
    selectedService,
    exceptionByDate,
    bookingAvailability,
    serviceAvailabilityRules,
    effectiveBlockedSlotKeys,
  ])

  const fmtDay = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [language]
  )

  const getStaffFirstName = React.useCallback((staff: StaffMember | null | undefined): string => {
    const normalized = (staff?.name ?? "").trim().replace(/\s+/g, " ")
    if (!normalized) return t("bookingPublic.noSelection")
    return normalized.split(" ")[0] ?? t("bookingPublic.noSelection")
  }, [t])

  const confirmBooking = () => {
    const clientName = joinPersonName(form.firstName, form.lastName)
    const customerPhone = buildStoredInternationalPhone(
      form.phoneDialCode,
      form.phoneNational,
    ).trim()
    if (!selectedServiceId || !selectedDayKey || !selectedTime) {
      setError(t("bookingPublic.required"))
      return
    }
    if (!form.firstName.trim() || !customerPhone) {
      setError(t("bookingPublic.fillRequired"))
      return
    }
    const pv = validateNationalPhoneLength(form.phoneDialCode, form.phoneNational)
    if (!pv.ok) {
      setError(
        pv.min === pv.max
          ? t("settings.phoneInvalidNationalLengthExact").replace("{n}", String(pv.min))
          : t("settings.phoneInvalidNationalLength")
              .replace("{min}", String(pv.min))
              .replace("{max}", String(pv.max)),
      )
      return
    }
    if (selectedServiceId && serviceStaff.length === 0) {
      setError(t("bookingPublic.noStaffAssignedToService"))
      return
    }

    void (async () => {
      const client = getBrowserClient()
      const useSupabaseOnline =
        Boolean(client) &&
        isSupabaseConfigured() &&
        normalizedSlug !== DEMO_BOOKING_SLUG

      if (useSupabaseOnline && client) {
        if (!businessProfileIdForSlug) {
          setError(t("bookingPublic.required"))
          return
        }
        if (!selectedService) {
          setError(t("bookingPublic.chooseService"))
          return
        }
        if (serviceStaff.length === 0) {
          setError(t("bookingPublic.noStaffAssignedToService"))
          return
        }
        const staffChoice = selectedStaffId ?? MANUAL_BOOKING_ANY_STAFF
        const resolved = await resolveManualBookingStaffSelection({
          client,
          businessId: businessProfileIdForSlug,
          service: selectedService,
          appointmentDate: selectedDayKey,
          appointmentTime: selectedTime,
          staffChoice,
          candidates: serviceStaff,
          hasActiveTeam: serviceStaff.length > 0,
        })
        if (!resolved.ok) {
          setError(t(resolved.errorKey))
          return
        }
        const resolvedStaffId = resolved.staffId
        const resolvedStaffName = resolved.staffName ?? undefined
        setIsSubmitting(true)
        setError(null)
        try {
          const res = await createOnlineBooking(client, {
            businessSlug: normalizedSlug,
            serviceId: selectedServiceId,
            staffId: resolvedStaffId,
            clientName,
            clientPhone: customerPhone,
            clientEmail: form.email.trim() || undefined,
            appointmentDate: selectedDayKey,
            appointmentTime: selectedTime,
            customerNote: form.note.trim() || undefined,
          })
          if (!res.ok || !res.id || !res.confirmationToken) {
            const baseMessage =
              res.error === "slot_taken"
                ? t("bookings.slotJustBooked")
                : res.error === "staff_service_not_allowed" ||
                    res.error === "staff_not_found" ||
                    res.error === "service_not_found"
                  ? t("bookingPublic.noStaffAssignedToService")
                  : t("bookings.createFailed")
            const detailsMessage =
              res.error &&
              res.error !== "slot_taken" &&
              res.error !== "staff_service_not_allowed" &&
              res.error !== "staff_not_found" &&
              res.error !== "service_not_found"
                ? `${baseMessage} (${res.error})`
                : baseMessage
            setError(detailsMessage)
            return
          }
          const publicBooking: PublicBooking = {
            id: res.id,
            confirmationToken: res.confirmationToken,
            businessSlug: normalizedSlug,
            serviceId: selectedServiceId,
            staffId: resolvedStaffId ?? undefined,
            staffName: resolvedStaffName,
            serviceName: selectedService?.name ?? "",
            serviceDurationMinutes: selectedService?.durationMinutes ?? 0,
            servicePrice: selectedService?.price ?? 0,
            date: selectedDayKey,
            time: selectedTime,
            customerName: clientName,
            customerPhone: customerPhone,
            customerEmail: form.email.trim() || undefined,
            note: form.note.trim() || undefined,
            status: "confirmed",
            source: "online",
            createdAt: new Date().toISOString(),
          }
          try {
            await notifyBookingCreatedAfterOnlineBooking(res.confirmationToken, language)
          } catch (err) {
            console.error("[booking.created.notify]", err)
          }
          router.push(
            `/rezerwacje/${encodeURIComponent(String(businessSlug))}/success?token=${encodeURIComponent(res.confirmationToken)}`
          )
        } finally {
          setIsSubmitting(false)
        }
        return
      }

      const bookingId = crypto.randomUUID()
      const demoConfirmationToken = crypto.randomUUID()
      let resolvedStaffId: string | null = null
      let resolvedStaffName: string | undefined
      if (serviceStaff.length === 1) {
        resolvedStaffId = serviceStaff[0]!.id
        resolvedStaffName = serviceStaff[0]!.name
      } else if (selectedStaffId) {
        const one = serviceStaff.find((x) => x.id === selectedStaffId)
        resolvedStaffId = one?.id ?? null
        resolvedStaffName = one?.name
      } else {
        const sorted = [...serviceStaff].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        )
        resolvedStaffId = sorted[0]?.id ?? null
        resolvedStaffName = sorted[0]?.name
      }

      const publicBooking: PublicBooking = {
        id: bookingId,
        confirmationToken: demoConfirmationToken,
        businessSlug: normalizedSlug,
        serviceId: selectedServiceId,
        staffId: resolvedStaffId ?? undefined,
        staffName: resolvedStaffName,
        serviceName: selectedService?.name ?? "",
        serviceDurationMinutes: selectedService?.durationMinutes ?? 0,
        servicePrice: selectedService?.price ?? 0,
        date: selectedDayKey,
        time: selectedTime,
        customerName: clientName,
        customerPhone: customerPhone,
        customerEmail: form.email.trim() || undefined,
        note: form.note.trim() || undefined,
        status: "confirmed",
        source: "online",
        createdAt: new Date().toISOString(),
      }

      try {
        savePublicBooking(publicBooking)
      } catch {
        // noop for MVP
      }

      router.push(
        `/rezerwacje/${encodeURIComponent(String(businessSlug))}/success?token=${encodeURIComponent(demoConfirmationToken)}`,
      )
    })()
  }


  if (businessNotFound) {
    return (
      <main className="min-h-screen bg-background px-4 py-16 sm:px-6">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm shadow-slate-900/5">
          <h1 className="text-lg font-semibold text-foreground">
            {t("auth.businessNotFoundTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.businessNotFoundBody")}
          </p>
        </div>
      </main>
    )
  }

  const displayBusinessName = businessTitle ?? BRAND.name

  return (
    <main className="min-h-screen bg-background px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-4 space-y-1.5">
          <Badge variant="outline" className="rounded-full">
            {t("bookingPublic.onlineBadge")}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {displayBusinessName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("bookingPublic.pageDescription")}
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-3">
            <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("bookingPublic.chooseService")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {servicesLoadFailed ? (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{t("bookingPublic.servicesLoadTryLater")}</p>
                    {servicesLoadDiagnostics ? (
                      <pre className="overflow-x-auto text-[10px] leading-snug text-muted-foreground/80">
                        {servicesLoadDiagnostics}
                      </pre>
                    ) : null}
                  </div>
                ) : !bookingServicesBusinessFound && normalizedSlug !== DEMO_BOOKING_SLUG ? (
                  <p className="text-sm text-muted-foreground">{t("bookingPublic.bookingPageNotFound")}</p>
                ) : bookingServicesBusinessFound && catalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("bookingPublic.businessHasNoActiveServicesYet")}</p>
                ) : catalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("bookingPublic.noServicesAvailable")}</p>
                ) : (
                  catalog.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(service.id)
                        setDayOverride(null)
                        setSelectedTime(null)
                      }}
                      className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                        selectedServiceId === service.id
                          ? "border-primary bg-[color:var(--nav-active-bg)]"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <p className="text-sm font-semibold text-foreground">{service.name}</p>
                      {service.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{service.description}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {service.durationMinutes} {t("services.min")} - {service.price}{" "}
                        {language === "pl"
                          ? (service.currency === "PLN" || !service.currency ? t("services.zł") : service.currency)
                          : service.currency ?? t("services.PLN")}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            {selectedServiceId ? (
              <>
                <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {serviceStaff.length === 1
                        ? t("bookingPublic.staffMemberLabel")
                        : t("bookingPublic.chooseStaffMember")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {serviceStaff.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("bookingPublic.noAssignedStaffContactBusiness")}</p>
                    ) : serviceStaff.length === 1 ? (
                      <p className="text-sm text-foreground">
                        {t("bookingPublic.singleStaffExecutingService").replace(
                          "{name}",
                          getStaffFirstName(serviceStaff[0] ?? null)
                        )}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <Label htmlFor="book-staff-select">{t("bookingPublic.chooseStaffMember")}</Label>
                        <select
                          id="book-staff-select"
                          value={selectedStaffId ?? ""}
                          onChange={(event) => {
                            const next = event.target.value
                            setSelectedStaffId(next || null)
                            setSelectedTime(null)
                          }}
                          className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground"
                        >
                          <option value="">{t("bookingPublic.anyAvailableStaff")}</option>
                          {(selectedDayKey && selectedTime ? availableStaffForSelectedSlot : serviceStaff).map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {getStaffFirstName(staff)}
                            </option>
                          ))}
                        </select>
                        {selectedDayKey && selectedTime && availableStaffForSelectedSlot.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("bookingPublic.noAvailableTimesForSelectedDay")}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
                {serviceStaff.length > 1 ? (
                  <p className="text-xs text-muted-foreground">{t("bookingPublic.staffSelectionChangesSlotsHint")}</p>
                ) : null}
              </>
            ) : null}

            {!blockCalendarForNoStaff ? (
              <>
                {availabilityLoadFailed ? (
                  <p className="text-sm text-muted-foreground" role="alert">
                    {t("availability.loadAvailabilityError")}
                  </p>
                ) : null}
                {availabilityNotConfigured && !availabilityLoadFailed && catalog.length > 0 ? (
                  <p className="text-sm text-muted-foreground" role="status">
                    {t("bookingPublic.availabilityNotConfigured")}
                  </p>
                ) : null}

                <PublicBookingCalendar
              language={language}
              t={t}
              clientToday={clientToday}
              availability={bookingAvailability}
              availabilityStrict={availabilityStrict}
              serviceDurationMinutes={selectedService?.durationMinutes ?? 60}
              asOfTime={clientToday ?? undefined}
              selectedDateKey={selectedDayKey}
              onSelectDate={setDayOverride}
              selectedTime={selectedTime}
              onSelectTime={setSelectedTime}
              blockedSlotKeys={effectiveBlockedSlotKeys}
              customSlotsForDate={customSlotsForDate}
              resolveAvailabilityDaysForDate={resolveAvailabilityDaysForDate}
              slotEmptyDetail={slotEmptyDetail}
              emptySlotsKey={
                availabilityStrict
                  ? "bookingPublic.noAvailableTimesForSelectedDay"
                  : "bookingPublic.noSlotsToday"
              }
            />
              </>
            ) : null}

            <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("bookingPublic.yourDetails")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2.5 pt-0">
                <div className="grid gap-1.5">
                  <Label htmlFor="book-firstname">{t("bookingPublic.firstName")}</Label>
                  <Input
                    id="book-firstname"
                    value={form.firstName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, firstName: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="book-lastname">{t("bookingPublic.lastName")}</Label>
                  <Input
                    id="book-lastname"
                    value={form.lastName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, lastName: e.target.value }))
                    }
                  />
                </div>
                <InternationalPhoneFieldGroup
                  label={t("bookingPublic.phone")}
                  dialCode={form.phoneDialCode}
                  nationalDigits={form.phoneNational}
                  onDialCodeChange={(v) => setForm((f) => ({ ...f, phoneDialCode: v }))}
                  onNationalChange={(digits) =>
                    setForm((f) => ({ ...f, phoneNational: digits }))
                  }
                  dialSelectId="book-phone-dial"
                  nationalInputId="book-phone"
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="book-email">{t("bookingPublic.email")}</Label>
                  <Input
                    id="book-email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="book-note">{t("bookingPublic.optionalNote")}</Label>
                  <Textarea
                    id="book-note"
                    rows={3}
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          <aside>
            <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5 lg:sticky lg:top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t("bookingPublic.summary")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pt-0 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("bookingPublic.service")}:</span>{" "}
                  <span className="font-medium text-foreground">
                    {selectedService?.name ?? t("bookingPublic.noSelection")}
                  </span>
                </p>
                {selectedServiceId ? (
                  <p>
                    <span className="text-muted-foreground">{t("appointments.fieldStaff")}:</span>{" "}
                    <span className="font-medium text-foreground">
                      {selectedStaffId
                        ? getStaffFirstName(serviceStaff.find((x) => x.id === selectedStaffId) ?? null)
                        : serviceStaff.length > 1
                          ? t("bookingPublic.anyAvailableStaff")
                          : getStaffFirstName(serviceStaff[0] ?? null)}
                    </span>
                  </p>
                ) : null}
                <p>
                  <span className="text-muted-foreground">{t("bookingPublic.duration")}:</span>{" "}
                  <span className="font-medium text-foreground">
                    {selectedService
                      ? `${selectedService.durationMinutes} ${t("services.min")}`
                      : t("bookingPublic.noSelection")}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t("bookingPublic.price")}:</span>{" "}
                  <span className="font-medium text-foreground">
                    {selectedService
                      ? `${selectedService.price} ${
                          language === "pl"
                            ? selectedService.currency === "PLN" || !selectedService.currency
                              ? t("services.zł")
                              : selectedService.currency
                            : selectedService.currency ?? t("services.PLN")
                        }`
                      : t("bookingPublic.noSelection")}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">
                    {t("bookingPublic.selectedSlotLabel")}:
                  </span>{" "}
                  <span className="font-medium text-foreground">
                    {selectedDayKey && selectedTime
                      ? `${fmtDay.format(parseLocalDateKey(selectedDayKey))}, ${selectedTime}`
                      : t("bookingPublic.noSelection")}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">{t("bookingPublic.clientDetails")}:</span>{" "}
                  <span className="font-medium text-foreground">
                    {joinPersonName(form.firstName, form.lastName) ||
                    buildStoredInternationalPhone(form.phoneDialCode, form.phoneNational).trim()
                      ? `${joinPersonName(form.firstName, form.lastName) || "-"} (${buildStoredInternationalPhone(form.phoneDialCode, form.phoneNational).trim() || "-"})`
                      : t("bookingPublic.noSelection")}
                  </span>
                </p>

                {error ? (
                  <p className="pt-1 text-xs text-red-600">{error}</p>
                ) : null}

                <Button
                  className="mt-3 w-full"
                  onClick={confirmBooking}
                  disabled={
                    isSubmitting ||
                    servicesLoadFailed ||
                    availabilityLoadFailed ||
                    blockCalendarForNoStaff ||
                    catalog.length === 0 ||
                    !selectedServiceId ||
                    !selectedDayKey ||
                    !selectedTime
                  }
                >
                  {t("bookingPublic.confirmBooking")}
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("bookingPublic.privacyNoticePrefix")}{" "}
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                    {t("bookingPublic.privacyNoticeLink")}
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </main>
  )
}
