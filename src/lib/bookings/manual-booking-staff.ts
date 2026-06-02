import type { SupabaseClient } from "@supabase/supabase-js"

import {
  getAvailabilityExceptionsForBusiness,
  getAvailabilityRules,
  getServiceAvailabilityRules,
} from "@/lib/availability/availability-store"
import {
  buildEffectiveAvailabilityDaysForDate,
  indexExceptionsByDate,
  pickServiceRuleForWeekday,
  resolveBookingException,
} from "@/lib/booking/effective-availability"
import { getSlotsForSelectedDate } from "@/lib/booking/availability-slots"
import { getAppToday } from "@/lib/date/current-date"
import { resolveBreakMinutes } from "@/lib/bookings/break-minutes"
import {
  hasStaffSchedulingIntervalOverlap,
  normalizeSlotTimeLabel,
  toBlockedSlotKeySetForStaff,
  getBookedSlotsForBusiness,
} from "@/lib/bookings/slot-availability"
import {
  getStaffAvailabilityContextForBusiness,
  type StaffAvailabilityExceptionRecord,
  type StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"
import { applyStaffAvailabilityToDays } from "@/lib/booking/staff-day-overlay"
import type { Database } from "@/types/database"
import type { AvailabilityDay, Service, StaffMember } from "@/types/domain"

export const MANUAL_BOOKING_ANY_STAFF = "__any__"

type PanelClient = SupabaseClient<Database>

function parseYmd(ymd: string): Date {
  const parts = ymd.trim().slice(0, 10).split("-").map((x) => Number(x))
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Date(y, m - 1, d)
}

export function applyStaffOverlayToWeek(
  days: AvailabilityDay[],
  cellDate: Date,
  staffRules: StaffAvailabilityRuleInput[],
  staffExceptions: StaffAvailabilityExceptionRecord[]
): AvailabilityDay[] {
  return applyStaffAvailabilityToDays(days, cellDate, staffRules, staffExceptions)
}

async function isManualBookingTimeInAllowedSlots(
  client: PanelClient,
  businessId: string,
  service: Pick<Service, "id" | "durationMinutes" | "breakMinutes" | "usesDefaultAvailability">,
  appointmentDate: string,
  appointmentTimeHm: string,
  staffId: string | null,
  defaultBreakMinutes?: number | null,
): Promise<boolean> {
  const dayKey = appointmentDate.trim().slice(0, 10)
  const cellDate = parseYmd(dayKey)
  const duration = Math.max(1, Math.floor(service.durationMinutes || 0))
  const breakMinutes = resolveBreakMinutes(service.breakMinutes, defaultBreakMinutes)

  const [bookingAvailability, exceptions, serviceRules] = await Promise.all([
    getAvailabilityRules(client, businessId),
    getAvailabilityExceptionsForBusiness(client, businessId, dayKey, dayKey),
    getServiceAvailabilityRules(client, businessId, service.id),
  ])

  const exceptionByDate = indexExceptionsByDate(exceptions)
  const exc = resolveBookingException(exceptionByDate.get(dayKey), cellDate)
  const usesDefault = service.usesDefaultAvailability !== false
  const rule = pickServiceRuleForWeekday(serviceRules, cellDate.getDay())
  let days = buildEffectiveAvailabilityDaysForDate(
    bookingAvailability,
    cellDate,
    exc,
    usesDefault,
    rule
  )

  if (staffId?.trim()) {
    const { rules: staffRules, exceptions: staffExceptions } =
      await getStaffAvailabilityContextForBusiness(client, businessId, staffId.trim())
    days = applyStaffOverlayToWeek(days, cellDate, staffRules, staffExceptions)
  }

  const asOf = getAppToday()
  const bookedRows = await getBookedSlotsForBusiness(client, businessId, dayKey, dayKey)
  const blocked = toBlockedSlotKeySetForStaff(
    bookedRows,
    staffId?.trim() ?? null,
    duration,
    breakMinutes,
  )
  const slots = getSlotsForSelectedDate(
    cellDate,
    asOf,
    asOf,
    duration,
    days,
    blocked,
  )
  const want = normalizeSlotTimeLabel(appointmentTimeHm)
  return slots.some((s) => normalizeSlotTimeLabel(s) === want)
}

export type ResolveManualStaffInput = {
  client: PanelClient
  businessId: string
  service: Pick<Service, "id" | "durationMinutes" | "breakMinutes" | "usesDefaultAvailability">
  appointmentDate: string
  appointmentTime: string
  staffChoice: string
  candidates: StaffMember[]
  hasActiveTeam: boolean
  defaultBreakMinutes?: number | null
  /** Przy edycji / propozycji zmiany — pomija kolizję z tą samą wizytą. */
  excludeBookingId?: string | null
  /**
   * `proposal` — copy dla „Zaproponuj zmianę” (np. przy „Dowolna osoba”).
   * Domyślnie komunikaty jak przy ręcznym dodawaniu wizyty.
   */
  availabilityFeedback?: "proposal"
}

export async function resolveManualBookingStaffSelection(
  input: ResolveManualStaffInput
): Promise<
  | { ok: true; staffId: string | null; staffName: string | null }
  | { ok: false; errorKey: string }
> {
  const choice = input.staffChoice.trim()
  const date = input.appointmentDate.trim()
  const time = input.appointmentTime.trim()
  if (!date || !time) {
    return { ok: false, errorKey: "appointments.manualInvalidDateTime" }
  }

  if (!input.hasActiveTeam) {
    return { ok: true, staffId: null, staffName: null }
  }

  if (input.candidates.length === 0) {
    return { ok: false, errorKey: "appointments.manualNoStaffForService" }
  }

  const durationMin = Math.max(1, Math.floor(Number(input.service.durationMinutes ?? 0) || 0))
  const breakMin = resolveBreakMinutes(input.service.breakMinutes, input.defaultBreakMinutes)
  const ex = input.excludeBookingId?.trim()

  const sorted = [...input.candidates].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  )

  if (sorted.length === 1) {
    const only = sorted[0]!
    const overlap = await hasStaffSchedulingIntervalOverlap(
      input.client,
      input.businessId,
      date,
      time,
      durationMin,
      only.id,
      { excludeBookingId: ex, breakMinutes: breakMin },
    )
    if (overlap) {
      return { ok: false, errorKey: "appointments.proposeStaffUnavailableSlot" }
    }
    const okSlot = await isManualBookingTimeInAllowedSlots(
      input.client,
      input.businessId,
      input.service,
      date,
      time,
      only.id,
      input.defaultBreakMinutes,
    )
    if (!okSlot) {
      return { ok: false, errorKey: "appointments.proposeStaffUnavailableSlot" }
    }
    return { ok: true, staffId: only.id, staffName: only.name }
  }

  if (!choice || choice === MANUAL_BOOKING_ANY_STAFF) {
    for (const member of sorted) {
      const overlap = await hasStaffSchedulingIntervalOverlap(
        input.client,
        input.businessId,
        date,
        time,
        durationMin,
        member.id,
        { excludeBookingId: ex, breakMinutes: breakMin },
      )
      if (overlap) continue
      const okSlot = await isManualBookingTimeInAllowedSlots(
        input.client,
        input.businessId,
        input.service,
        date,
        time,
        member.id,
        input.defaultBreakMinutes,
      )
      if (!okSlot) continue
      return { ok: true, staffId: member.id, staffName: member.name }
    }
    return {
      ok: false,
      errorKey:
        input.availabilityFeedback === "proposal"
          ? "appointments.proposeNoStaffAvailableStaff"
          : "appointments.manualNoAvailableStaff",
    }
  }

  const picked = sorted.find((m) => m.id === choice)
  if (!picked) {
    return { ok: false, errorKey: "appointments.manualStaffWrongService" }
  }

  const overlap = await hasStaffSchedulingIntervalOverlap(
    input.client,
    input.businessId,
    date,
    time,
    durationMin,
    picked.id,
    { excludeBookingId: ex, breakMinutes: breakMin },
  )
  if (overlap) {
    return { ok: false, errorKey: "appointments.proposeStaffUnavailableSlot" }
  }

  const okSlot = await isManualBookingTimeInAllowedSlots(
    input.client,
    input.businessId,
    input.service,
    date,
    time,
    picked.id,
    input.defaultBreakMinutes,
  )
  if (!okSlot) {
    return { ok: false, errorKey: "appointments.proposeStaffUnavailableSlot" }
  }

  return { ok: true, staffId: picked.id, staffName: picked.name }
}

/**
 * Pełny test dostępności pracownika na slot (wizyty innych klientów + grafik firmy/usługi + grafik osoby + wyjątki).
 */
export async function isStaffAvailableForSlot(input: {
  client: PanelClient
  businessId: string
  staffId: string
  service: Pick<Service, "id" | "durationMinutes" | "breakMinutes" | "usesDefaultAvailability">
  date: string
  startTime: string
  excludeBookingId?: string | null
  defaultBreakMinutes?: number | null
}): Promise<boolean> {
  const durationMin = Math.max(1, Math.floor(Number(input.service.durationMinutes ?? 0) || 0))
  const breakMin = resolveBreakMinutes(input.service.breakMinutes, input.defaultBreakMinutes)
  const overlap = await hasStaffSchedulingIntervalOverlap(
    input.client,
    input.businessId,
    input.date,
    input.startTime,
    durationMin,
    input.staffId.trim(),
    { excludeBookingId: input.excludeBookingId?.trim(), breakMinutes: breakMin },
  )
  if (overlap) return false
  return isManualBookingTimeInAllowedSlots(
    input.client,
    input.businessId,
    input.service,
    input.date.trim(),
    input.startTime.trim(),
    input.staffId.trim(),
    input.defaultBreakMinutes,
  )
}
