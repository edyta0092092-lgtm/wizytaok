import type { AvailabilityExceptionRecord } from "@/lib/booking/effective-availability"
import type { PolishHolidayEntry } from "@/lib/calendar/polish-holidays"
import type { StaffAvailabilityRuleInput } from "@/lib/staff/staff-store"
import type { AvailabilityDay, StaffMember } from "@/types/domain"

export type StaffDaySchedule = {
  staffId: string
  fullName: string
  status: "working" | "off" | "inactive"
  startTime: string | null
  endTime: string | null
  source:
    | "business_hours"
    | "staff_hours"
    | "exception_available"
    | "exception_unavailable"
    | "holiday"
    | "business_closed"
    | "inactive"
  note: string | null
  holidayName: string | null
  /** Odbiega od domyślnych godzin firmy tego dnia lub pochodzi z wyjątku „dostępny w godzinach”. */
  isSpecialHours: boolean
}

export type TeamScheduleDayCell = {
  date: string
  holiday: PolishHolidayEntry | null
  businessOpen: boolean
  /** Syntetyczna nazwa gdy firma zamknięta w święto (PL/EN ustawiane w UI). */
  schedules: StaffDaySchedule[]
}

function formatHmFromDb(value: string | null | undefined): string {
  const s = String(value ?? "").trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
}

/** 0 = niedziela … 6 = sobota (zgodnie z availability_rules.weekday). */
export function getWeekdayFromYmd(ymd: string): number {
  const [y, mo, d] = ymd.split("-").map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return 0
  return new Date(y, mo - 1, d).getDay()
}

type BusinessWindow = { isOpen: boolean; startTime: string; endTime: string }

/**
 * Efektywne okno pracy firmy: reguły tygodnia + wyjątek dzienny + domyślne zamknięcie w święto ustawowe (gdy brak wpisu firmy).
 */
export function resolveBusinessWindowForDate(
  dateKey: string,
  baseDays: AvailabilityDay[],
  businessException: AvailabilityExceptionRecord | null,
  polishHoliday: PolishHolidayEntry | null
): BusinessWindow {
  const wd = getWeekdayFromYmd(dateKey)
  const base =
    baseDays.find((x) => x.weekday === wd) ??
    ({
      isOpen: false,
      startTime: "09:00",
      endTime: "17:00",
    } as AvailabilityDay)

  if (businessException) {
    if (businessException.is_closed) {
      return { isOpen: false, startTime: base.startTime, endTime: base.endTime }
    }
    if (businessException.start_time && businessException.end_time) {
      return {
        isOpen: true,
        startTime: formatHmFromDb(businessException.start_time),
        endTime: formatHmFromDb(businessException.end_time),
      }
    }
  }

  if (polishHoliday && !businessException) {
    return { isOpen: false, startTime: base.startTime, endTime: base.endTime }
  }

  return {
    isOpen: base.isOpen,
    startTime: base.startTime,
    endTime: base.endTime,
  }
}

export type StaffExceptionForDay = {
  isUnavailable: boolean
  startTime: string | null
  endTime: string | null
  reason: string | null
}

export function getStaffScheduleForDay(input: {
  date: string
  staffMember: StaffMember
  businessBaseDays: AvailabilityDay[]
  businessException: AvailabilityExceptionRecord | null
  staffRules: StaffAvailabilityRuleInput[]
  staffException: StaffExceptionForDay | null
  polishHoliday: PolishHolidayEntry | null
}): StaffDaySchedule {
  const {
    date,
    staffMember,
    businessBaseDays,
    businessException,
    staffRules,
    staffException,
    polishHoliday,
  } = input

  const id = staffMember.id
  const fullName = staffMember.name

  if (!staffMember.isActive) {
    return {
      staffId: id,
      fullName,
      status: "inactive",
      startTime: null,
      endTime: null,
      source: "inactive",
      note: null,
      holidayName: null,
      isSpecialHours: false,
    }
  }

  if (staffException) {
    if (staffException.isUnavailable) {
      return {
        staffId: id,
        fullName,
        status: "off",
        startTime: null,
        endTime: null,
        source: "exception_unavailable",
        note: staffException.reason,
        holidayName: null,
        isSpecialHours: false,
      }
    }
    const st = staffException.startTime?.trim() ?? ""
    const en = staffException.endTime?.trim() ?? ""
    if (st && en) {
      return {
        staffId: id,
        fullName,
        status: "working",
        startTime: st,
        endTime: en,
        source: "exception_available",
        note: staffException.reason,
        holidayName: null,
        isSpecialHours: true,
      }
    }
  }

  const bizWin = resolveBusinessWindowForDate(date, businessBaseDays, businessException, polishHoliday)

  const useBusinessHours = staffRules.length === 0

  if (!bizWin.isOpen) {
    const isHolidaySource = Boolean(polishHoliday && !businessException)
    return {
      staffId: id,
      fullName,
      status: "off",
      startTime: null,
      endTime: null,
      source: isHolidaySource ? "holiday" : "business_closed",
      note: null,
      holidayName: polishHoliday ? polishHoliday.namePl : null,
      isSpecialHours: false,
    }
  }

  if (useBusinessHours) {
    return {
      staffId: id,
      fullName,
      status: "working",
      startTime: bizWin.startTime,
      endTime: bizWin.endTime,
      source: "business_hours",
      note: null,
      holidayName: polishHoliday ? polishHoliday.namePl : null,
      isSpecialHours: false,
    }
  }

  const wd = getWeekdayFromYmd(date)
  const rule = staffRules.find((r) => r.weekday === wd)
  if (!rule || !rule.isAvailable) {
    return {
      staffId: id,
      fullName,
      status: "off",
      startTime: null,
      endTime: null,
      source: "staff_hours",
      note: null,
      holidayName: polishHoliday ? polishHoliday.namePl : null,
      isSpecialHours: false,
    }
  }

  const sameAsBiz =
    rule.startTime === bizWin.startTime && rule.endTime === bizWin.endTime && bizWin.isOpen

  return {
    staffId: id,
    fullName,
    status: "working",
    startTime: rule.startTime,
    endTime: rule.endTime,
    source: "staff_hours",
    note: null,
    holidayName: polishHoliday ? polishHoliday.namePl : null,
    isSpecialHours: !sameAsBiz,
  }
}

export type MonthScheduleOptions = {
  month: number
  year: number
  staffMembers: StaffMember[]
  businessBaseDays: AvailabilityDay[]
  /** exception_date (YYYY-MM-DD) → rekord */
  businessExceptionsByDate: Map<string, AvailabilityExceptionRecord>
  /** staffId → reguły tygodnia (pusty = godziny firmy). */
  staffRulesByStaffId: Map<string, StaffAvailabilityRuleInput[]>
  /** `${staffId}|${dateKey}` → wyjątek */
  staffExceptionsByStaffAndDate: Map<string, StaffExceptionForDay>
  /** dateKey → święto (opcjonalnie cache getPolishHolidayEntryForDateKey). */
  polishHolidayByDate: Map<string, PolishHolidayEntry | null>
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function getMonthSchedule(opts: MonthScheduleOptions): TeamScheduleDayCell[] {
  const {
    month,
    year,
    staffMembers,
    businessBaseDays,
    businessExceptionsByDate,
    staffRulesByStaffId,
    staffExceptionsByStaffAndDate,
    polishHolidayByDate,
  } = opts

  const dim = daysInMonth(year, month)
  const out: TeamScheduleDayCell[] = []

  for (let d = 1; d <= dim; d++) {
    const date = `${year}-${pad2(month)}-${pad2(d)}`
    const ph = polishHolidayByDate.get(date) ?? null
    const bizEx = businessExceptionsByDate.get(date) ?? null
    const bizWin = resolveBusinessWindowForDate(date, businessBaseDays, bizEx, ph)

    const schedules: StaffDaySchedule[] = []
    for (const m of staffMembers) {
      const rules = staffRulesByStaffId.get(m.id) ?? []
      const sk = `${m.id}|${date}`
      const ex = staffExceptionsByStaffAndDate.get(sk) ?? null
      schedules.push(
        getStaffScheduleForDay({
          date,
          staffMember: m,
          businessBaseDays,
          businessException: bizEx,
          staffRules: rules,
          staffException: ex,
          polishHoliday: ph,
        }),
      )
    }

    out.push({
      date,
      holiday: ph,
      businessOpen: bizWin.isOpen,
      schedules,
    })
  }

  return out
}
