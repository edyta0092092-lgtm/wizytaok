import {
  buildEffectiveAvailabilityDaysForDate,
  resolveBookingException,
  type AvailabilityExceptionRecord,
} from "@/lib/booking/effective-availability"
import { getSlotsForSelectedDate, toLocalDateKey } from "@/lib/booking/availability-slots"
import { applyStaffOverlayToWeek } from "@/lib/bookings/manual-booking-staff"
import {
  isBookingBlockingSlot,
  toBlockedSlotKeySetForStaff,
  type BookedAppointmentSlot,
} from "@/lib/bookings/slot-availability"
import { getAppToday } from "@/lib/date/current-date"
import type {
  StaffAvailabilityExceptionRecord,
  StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"
import type { AvailabilityDay, StaffMember } from "@/types/domain"

export type StaffAvailabilityContext = {
  rules: StaffAvailabilityRuleInput[]
  exceptions: StaffAvailabilityExceptionRecord[]
}

export type PanelFreeSlotsByDate = {
  date: string
  times: string[]
}

export type ComputePanelFreeSlotsInput = {
  year: number
  month: number
  durationMinutes: number
  businessAvailability: AvailabilityDay[]
  businessExceptionsByDate: Map<string, AvailabilityExceptionRecord | null>
  bookedSlots: BookedAppointmentSlot[]
  staffMembers: StaffMember[]
  staffContexts: Map<string, StaffAvailabilityContext>
  personFilterStaffId: string | null
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

type PanelFreeSlotsDayInput = Omit<ComputePanelFreeSlotsInput, "year" | "month">

function computeFreeSlotTimesForDay(
  cellDate: Date,
  input: PanelFreeSlotsDayInput,
): string[] {
  const {
    durationMinutes,
    businessAvailability,
    businessExceptionsByDate,
    bookedSlots,
    staffMembers,
    staffContexts,
    personFilterStaffId,
  } = input

  const duration = Math.max(15, Math.floor(durationMinutes || 30))
  const asOf = getAppToday()
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const activeStaff = staffMembers.filter((s) => s.isActive)
  const staffScope = personFilterStaffId
    ? activeStaff.filter((s) => s.id === personFilterStaffId)
    : activeStaff

  const dateKey = toLocalDateKey(cellDate)
  const exc = resolveBookingException(
    businessExceptionsByDate.get(dateKey) ?? null,
    cellDate,
  )
  const businessDays = buildEffectiveAvailabilityDaysForDate(
    businessAvailability,
    cellDate,
    exc,
    true,
    null,
  )

  const union = new Set<string>()
  const staffList = staffScope.length > 0 ? staffScope : activeStaff

  if (staffList.length === 0) {
    const blocked = toBlockedSlotKeySetForStaff(bookedSlots, null, duration)
    return getSlotsForSelectedDate(cellDate, today, asOf, duration, businessDays, blocked)
  }

  for (const member of staffList) {
    const ctx = staffContexts.get(member.id)
    const days = ctx
      ? applyStaffOverlayToWeek(businessDays, cellDate, ctx.rules, ctx.exceptions)
      : businessDays
    const blocked = toBlockedSlotKeySetForStaff(bookedSlots, member.id, duration)
    const slots = getSlotsForSelectedDate(cellDate, today, asOf, duration, days, blocked)
    for (const t of slots) union.add(t)
  }

  return Array.from(union).sort((a, b) => a.localeCompare(b))
}

export function computePanelFreeSlotsForMonth(
  input: ComputePanelFreeSlotsInput,
): PanelFreeSlotsByDate[] {
  const { year, month, ...dayInput } = input
  const asOf = getAppToday()
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const dim = daysInMonth(year, month)
  const out: PanelFreeSlotsByDate[] = []

  for (let d = 1; d <= dim; d++) {
    const cellDate = new Date(year, month - 1, d)
    if (startOfLocalDay(cellDate) < startOfLocalDay(today)) continue

    const times = computeFreeSlotTimesForDay(cellDate, dayInput)
    if (times.length > 0) {
      out.push({ date: toLocalDateKey(cellDate), times })
    }
  }

  return out
}

export function computePanelFreeSlotsForNextDays(
  input: PanelFreeSlotsDayInput & { dayCount?: number },
): PanelFreeSlotsByDate[] {
  const { dayCount = 7, ...dayInput } = input
  const asOf = getAppToday()
  const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const out: PanelFreeSlotsByDate[] = []

  for (let i = 0; i < dayCount; i++) {
    const cellDate = new Date(today)
    cellDate.setDate(cellDate.getDate() + i)
    out.push({
      date: toLocalDateKey(cellDate),
      times: computeFreeSlotTimesForDay(cellDate, dayInput),
    })
  }

  return out
}

export function calendarEntriesToBookedSlots(rows: readonly {
  id: string
  appointment_date: string
  appointment_time: string
  status: string
  staff_id: string | null
}[]): BookedAppointmentSlot[] {
  return rows
    .filter((r) => isBookingBlockingSlot(r.status))
    .map((r) => ({
      id: r.id,
      appointment_date: r.appointment_date,
      appointment_time: r.appointment_time,
      status: r.status,
      staff_id: r.staff_id,
    }))
}
