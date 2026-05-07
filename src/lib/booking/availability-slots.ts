import type { AvailabilityDay } from "@/types/domain"
import { blockedSlotKey, filterAvailableSlots } from "@/lib/bookings/slot-availability"

const SLOT_STEP_MIN = 15

export function toLocalDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function timeToMinutes(t: string): number {
  const [h, m = "0"] = t.split(":").map((x) => String(x).trim())
  return Number(h) * 60 + Number(m)
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Czy dzień jest co najmniej startem „dzisiaj” (nie przeszły kalendarzowy).
 */
function isOnOrAfterToday(d: Date, today: Date): boolean {
  return startOfLocalDay(d) >= startOfLocalDay(today)
}

function workWindowsForDay(
  d: Date,
  days: AvailabilityDay[]
): [number, number][] {
  const dow = d.getDay()
  const day = days.find((x) => x.weekday === dow)
  if (!day || !day.isOpen) return []
  const startM = timeToMinutes(day.startTime)
  const endM = timeToMinutes(day.endTime)
  if (endM <= startM) return []

  if (day.breakStart && day.breakEnd) {
    const brS = timeToMinutes(day.breakStart)
    const brE = timeToMinutes(day.breakEnd)
    if (brS < brE && brS > startM && brE < endM) {
      const split: [number, number][] = [
        [startM, brS],
        [brE, endM],
      ]
      return split.filter(([a, b]) => b - a > 0)
    }
  }
  return [[startM, endM]]
}

/**
 * Sloty startowe w dniu `date` dla długości usługi `durationMinutes`, kroku SLOT_STEP_MIN.
 */
export function buildSlotsForDate(
  date: Date,
  durationMinutes: number,
  days: AvailabilityDay[]
): string[] {
  if (durationMinutes <= 0) return []
  const windows = workWindowsForDay(date, days)
  if (windows.length === 0) return []
  const out: string[] = []
  for (const [winStart, winEnd] of windows) {
    for (let t = winStart; t + durationMinutes <= winEnd; t += SLOT_STEP_MIN) {
      out.push(minutesToTime(t))
    }
  }
  return out
}

/**
 * Dla dnia bieżącego usuwa sloty z już upłyniętą godziną (względem asOfTime).
 */
export function filterSlotsNotInPast(
  slots: string[],
  dayKey: string,
  asOf: Date
): string[] {
  if (toLocalDateKey(asOf) !== dayKey) return slots
  const nowM = asOf.getHours() * 60 + asOf.getMinutes()
  return slots.filter((s) => {
    const t = timeToMinutes(s)
    return t >= nowM
  })
}

/**
 * Czy w danym dniu jest choć jeden dopuszczalny slot (dla asOf — wyklucz przeszłość w „dzisiaj”).
 */
export function isDayOpenForAvailability(
  cellDate: Date,
  today: Date,
  asOf: Date,
  durationMinutes: number,
  days: AvailabilityDay[],
  blockedSlotKeys?: ReadonlySet<string> | null
): boolean {
  if (!isOnOrAfterToday(cellDate, today)) return false
  const key = toLocalDateKey(cellDate)
  let slots = buildSlotsForDate(cellDate, durationMinutes, days)
  if (key === toLocalDateKey(today)) {
    slots = filterSlotsNotInPast(slots, key, asOf)
  }
  if (blockedSlotKeys && blockedSlotKeys.size > 0) {
    slots = slots.filter((s) => !blockedSlotKeys.has(blockedSlotKey(key, s)))
  }
  return slots.length > 0
}

export function getSlotsForSelectedDate(
  selectedDate: Date,
  today: Date,
  asOf: Date,
  durationMinutes: number,
  days: AvailabilityDay[],
  blockedSlotKeys?: ReadonlySet<string> | null
): string[] {
  const key = toLocalDateKey(selectedDate)
  let slots = buildSlotsForDate(selectedDate, durationMinutes, days)
  if (key === toLocalDateKey(today)) {
    slots = filterSlotsNotInPast(slots, key, asOf)
  }
  if (blockedSlotKeys && blockedSlotKeys.size > 0) {
    slots = filterAvailableSlots(slots, key, blockedSlotKeys)
  }
  return slots
}

/**
 * Pierwsza data od `today` z co najmniej jednym wolnym slotem.
 */
export function findFirstOpenBookingDateKey(
  today: Date,
  days: AvailabilityDay[],
  durationMinutes: number,
  asOf: Date,
  blockedSlotKeys?: ReadonlySet<string> | null,
  resolveDaysForDate?: (d: Date) => AvailabilityDay[]
): string | null {
  if (days.length === 0 && !resolveDaysForDate) return null
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    const model = resolveDaysForDate ? resolveDaysForDate(d) : days
    if (model.length === 0) continue
    if (isDayOpenForAvailability(d, today, asOf, durationMinutes, model, blockedSlotKeys)) {
      return toLocalDateKey(d)
    }
  }
  return null
}
