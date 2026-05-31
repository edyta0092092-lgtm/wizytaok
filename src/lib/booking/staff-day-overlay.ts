import { toLocalDateKey } from "@/lib/booking/availability-slots"
import type {
  StaffAvailabilityExceptionRecord,
  StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"
import type { AvailabilityDay } from "@/types/domain"

function timeToMinutes(t: string): number {
  const [h, m = "0"] = t.split(":").map((x) => String(x).trim())
  return Number(h) * 60 + Number(m)
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Przecięcie okna „firma + usługa + wyjątek firmy” z oknem grafiku pracownika.
 * Bez tego reguła tygodnia pracownika (np. 9–17) nadpisywała węższy dzień firmy (np. wyjątek 10–13).
 */
function intersectDayWithStaffHours(day: AvailabilityDay, staffStart: string, staffEnd: string): AvailabilityDay {
  const s = String(staffStart).trim()
  const e = String(staffEnd).trim()
  if (!day.isOpen) {
    return { ...day, breakStart: undefined, breakEnd: undefined }
  }
  if (e <= s) {
    return { ...day, isOpen: false, breakStart: undefined, breakEnd: undefined }
  }
  const b1 = timeToMinutes(day.startTime)
  const b2 = timeToMinutes(day.endTime)
  const o1 = timeToMinutes(s)
  const o2 = timeToMinutes(e)
  const start = Math.max(b1, o1)
  const end = Math.min(b2, o2)
  if (end <= start) {
    return { ...day, isOpen: false, breakStart: undefined, breakEnd: undefined }
  }
  const next: AvailabilityDay = {
    ...day,
    isOpen: true,
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
    breakStart: undefined,
    breakEnd: undefined,
  }
  if (day.breakStart && day.breakEnd) {
    const brS = timeToMinutes(day.breakStart)
    const brE = timeToMinutes(day.breakEnd)
    if (brS >= start && brE <= end && brS < brE) {
      next.breakStart = day.breakStart
      next.breakEnd = day.breakEnd
    }
  }
  return next
}

function closeAvailabilityDay(day: AvailabilityDay): AvailabilityDay {
  return { ...day, isOpen: false, breakStart: undefined, breakEnd: undefined }
}

/** Nakładka grafiku + wyjątków pojedynczej osoby na już wyliczone dni dostępności (firma/usługa). */
export function applyStaffAvailabilityToDays(
  days: AvailabilityDay[],
  d: Date,
  rules: StaffAvailabilityRuleInput[],
  exceptions: StaffAvailabilityExceptionRecord[],
): AvailabilityDay[] {
  const usesCustomStaffSchedule = rules.length > 0
  const key = toLocalDateKey(d)
  const wd = d.getDay()
  const staffRule = rules.find((x) => x.weekday === wd)
  const staffExc = exceptions.find((x) => x.exceptionDate === key)
  return days.map((day) => {
    if (day.weekday !== wd) return day
    if (staffExc) {
      if (staffExc.isUnavailable) {
        return closeAvailabilityDay(day)
      }
      if (staffExc.startTime && staffExc.endTime) {
        return intersectDayWithStaffHours(day, staffExc.startTime, staffExc.endTime)
      }
      // Exception row exists, so treat it as day-level override.
      // If it has no explicit hours and is not closed, keep company/service day as-is.
      return day
    }
    if (!staffRule) {
      return usesCustomStaffSchedule ? closeAvailabilityDay(day) : day
    }
    if (!staffRule.isAvailable) {
      return closeAvailabilityDay(day)
    }
    return intersectDayWithStaffHours(day, staffRule.startTime, staffRule.endTime)
  })
}
