import { getSlotsForSelectedDate, filterSlotsNotInPast, toLocalDateKey } from "@/lib/booking/availability-slots"
import { normalizeSlotTimeLabel, toBlockedSlotKeySetForStaff, type BookedAppointmentSlot } from "@/lib/bookings/slot-availability"
import type { AvailabilityDay } from "@/types/domain"
import type { StaffMember } from "@/types/domain"

/** Sloty w dniu `cellDate` dla trybu „dowolna osoba”: suma slotów wszystkich przypisanych osób (z ich grafikami i blokadami). */
export function mergeSlotsForAnyAssignedStaff(
  cellDate: Date,
  clientToday: Date,
  asOf: Date,
  durationMinutes: number,
  staffMembers: StaffMember[],
  resolveDaysForStaff: (staffId: string, d: Date) => AvailabilityDay[],
  bookedRows: readonly BookedAppointmentSlot[],
  breakMinutes = 0,
): string[] {
  if (staffMembers.length === 0) return []
  const uniq = new Set<string>()
  for (const m of staffMembers) {
    const dayModel = resolveDaysForStaff(m.id, cellDate)
    const blocked = toBlockedSlotKeySetForStaff(
      bookedRows,
      m.id,
      Math.max(1, durationMinutes),
      Math.max(0, breakMinutes),
    )
    const slots = getSlotsForSelectedDate(
      cellDate,
      clientToday,
      asOf,
      Math.max(1, durationMinutes),
      dayModel,
      blocked,
    )
    for (const s of slots) uniq.add(normalizeSlotTimeLabel(s))
  }
  return Array.from(uniq).sort((a, b) => a.localeCompare(b))
}

export function dayHasMergedStaffSlot(
  cellDate: Date,
  clientToday: Date,
  asOf: Date,
  durationMinutes: number,
  staffMembers: StaffMember[],
  resolveDaysForStaff: (staffId: string, d: Date) => AvailabilityDay[],
  bookedRows: readonly BookedAppointmentSlot[],
  breakMinutes = 0,
): boolean {
  const key = toLocalDateKey(cellDate)
  let slots = mergeSlotsForAnyAssignedStaff(
    cellDate,
    clientToday,
    asOf,
    durationMinutes,
    staffMembers,
    resolveDaysForStaff,
    bookedRows,
    breakMinutes,
  )
  if (key === toLocalDateKey(clientToday)) {
    slots = filterSlotsNotInPast(slots, key, asOf)
  }
  return slots.length > 0
}

export function findFirstDateKeyWithMergedStaffSlots(
  today: Date,
  asOf: Date,
  durationMinutes: number,
  staffMembers: StaffMember[],
  resolveDaysForStaff: (staffId: string, d: Date) => AvailabilityDay[],
  bookedRows: readonly BookedAppointmentSlot[],
  breakMinutes = 0,
): string | null {
  for (let i = 0; i < 400; i += 1) {
    const cellDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    if (
      dayHasMergedStaffSlot(
        cellDate,
        today,
        asOf,
        durationMinutes,
        staffMembers,
        resolveDaysForStaff,
        bookedRows,
        breakMinutes,
      )
    ) {
      return toLocalDateKey(cellDate)
    }
  }
  return null
}
