import { toLocalDateKey } from "@/lib/booking/availability-slots"
import type {
  StaffAvailabilityExceptionRecord,
  StaffAvailabilityRuleInput,
} from "@/lib/staff/staff-store"
import type { AvailabilityDay } from "@/types/domain"

/** Nakładka grafiku + wyjątków pojedynczej osoby na już wyliczone dni dostępności (firma/usługa). */
export function applyStaffAvailabilityToDays(
  days: AvailabilityDay[],
  d: Date,
  rules: StaffAvailabilityRuleInput[],
  exceptions: StaffAvailabilityExceptionRecord[],
): AvailabilityDay[] {
  const key = toLocalDateKey(d)
  const wd = d.getDay()
  const staffRule = rules.find((x) => x.weekday === wd)
  const staffExc = exceptions.find((x) => x.exceptionDate === key)
  return days.map((day) => {
    if (day.weekday !== wd) return day
    if (staffExc) {
      if (staffExc.isUnavailable) {
        return { ...day, isOpen: false }
      }
      if (staffExc.startTime && staffExc.endTime) {
        const start = staffExc.startTime
        const end = staffExc.endTime
        if (end <= start) return { ...day, isOpen: false }
        return {
          ...day,
          isOpen: true,
          startTime: start,
          endTime: end,
        }
      }
      // Exception row exists, so treat it as day-level override.
      // If it has no explicit hours and is not closed, keep company/service day as-is.
      return day
    }
    if (!staffRule) return day
    if (!staffRule.isAvailable) {
      return { ...day, isOpen: false }
    }
    const start = staffRule.startTime
    const end = staffRule.endTime
    if (end <= start) return { ...day, isOpen: false }
    return {
      ...day,
      isOpen: true,
      startTime: start,
      endTime: end,
    }
  })
}
