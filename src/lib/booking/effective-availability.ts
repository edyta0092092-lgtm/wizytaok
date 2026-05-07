import type { AvailabilityDay } from "@/types/domain"
import { isPolishPublicHoliday } from "@/lib/calendar/polish-holidays"
import { toLocalDateKey } from "@/lib/booking/availability-slots"

export type AvailabilityExceptionRecord = {
  id: string
  business_id: string
  exception_date: string
  is_closed: boolean
  start_time: string | null
  end_time: string | null
  reason: string | null
}

export type ServiceAvailabilityRuleRecord = {
  id: string
  business_id: string
  service_id: string
  weekday: number
  is_available: boolean
  start_time: string
  end_time: string
}

function formatTimeFromDb(value: string | null | undefined): string {
  const s = String(value ?? "").trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "09:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
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

function intersectBusinessDayWithServiceWindow(
  businessDay: AvailabilityDay,
  svcStart: string,
  svcEnd: string
): AvailabilityDay {
  if (!businessDay.isOpen) return businessDay
  const a1 = timeToMinutes(businessDay.startTime)
  const a2 = timeToMinutes(businessDay.endTime)
  const b1 = timeToMinutes(svcStart)
  const b2 = timeToMinutes(svcEnd)
  const s = Math.max(a1, b1)
  const e = Math.min(a2, b2)
  if (e <= s) return { ...businessDay, isOpen: false }
  return {
    ...businessDay,
    isOpen: true,
    startTime: minutesToTime(s),
    endTime: minutesToTime(e),
  }
}

/**
 * Tygodniowy widok AvailabilityDay[] z nadpisanym jednym dniem (wyjątek + opcjonalnie reguła usługi).
 */
export function buildEffectiveAvailabilityDaysForDate(
  baseWeekly: AvailabilityDay[],
  cellDate: Date,
  exception: AvailabilityExceptionRecord | null | undefined,
  serviceUsesDefault: boolean,
  serviceRule: ServiceAvailabilityRuleRecord | null | undefined
): AvailabilityDay[] {
  const wd = cellDate.getDay()
  const base =
    baseWeekly.find((d) => d.weekday === wd) ??
    ({
      id: `wd-${wd}`,
      weekday: wd,
      label: "monday",
      isOpen: false,
      startTime: "09:00",
      endTime: "17:00",
    } as AvailabilityDay)

  let effective: AvailabilityDay = { ...base }
  if (exception) {
    if (exception.is_closed) {
      effective = { ...base, isOpen: false }
    } else if (exception.start_time && exception.end_time) {
      effective = {
        ...base,
        isOpen: true,
        startTime: formatTimeFromDb(exception.start_time),
        endTime: formatTimeFromDb(exception.end_time),
      }
    }
  }

  if (serviceUsesDefault) {
    return baseWeekly.map((d) => (d.weekday === wd ? effective : d))
  }

  if (!serviceRule || !serviceRule.is_available) {
    const closed: AvailabilityDay = { ...effective, isOpen: false }
    return baseWeekly.map((d) => (d.weekday === wd ? closed : d))
  }

  const intersected = intersectBusinessDayWithServiceWindow(
    effective,
    formatTimeFromDb(serviceRule.start_time),
    formatTimeFromDb(serviceRule.end_time)
  )
  return baseWeekly.map((d) => (d.weekday === wd ? intersected : d))
}

export function indexExceptionsByDate(
  rows: readonly AvailabilityExceptionRecord[]
): Map<string, AvailabilityExceptionRecord> {
  const m = new Map<string, AvailabilityExceptionRecord>()
  for (const r of rows) {
    const k = String(r.exception_date).slice(0, 10)
    m.set(k, r)
  }
  return m
}

export function pickServiceRuleForWeekday(
  rules: readonly ServiceAvailabilityRuleRecord[] | null | undefined,
  weekday: number
): ServiceAvailabilityRuleRecord | null {
  if (!rules?.length) return null
  return rules.find((r) => r.weekday === weekday) ?? null
}

export function isClosedAllDayByException(
  exception: AvailabilityExceptionRecord | null | undefined
): boolean {
  return Boolean(exception?.is_closed)
}

export function emptySlotsReason(
  baseWeekly: AvailabilityDay[],
  cellDate: Date,
  exception: AvailabilityExceptionRecord | null | undefined,
  serviceUsesDefault: boolean,
  serviceRule: ServiceAvailabilityRuleRecord | null | undefined,
  slotsLength: number
): "closed" | "service" | "other" {
  if (slotsLength > 0) return "other"
  if (isClosedAllDayByException(exception)) return "closed"
  const wd = cellDate.getDay()
  const base =
    baseWeekly.find((d) => d.weekday === wd) ??
    ({ isOpen: false, startTime: "09:00", endTime: "17:00" } as AvailabilityDay)
  let effective: AvailabilityDay = { ...base }
  if (exception && !exception.is_closed && exception.start_time && exception.end_time) {
    effective = {
      ...base,
      isOpen: true,
      startTime: formatTimeFromDb(exception.start_time),
      endTime: formatTimeFromDb(exception.end_time),
    }
  }
  if (!effective.isOpen) return "other"
  if (!serviceUsesDefault) {
    if (!serviceRule || !serviceRule.is_available) return "service"
    const merged = intersectBusinessDayWithServiceWindow(
      effective,
      formatTimeFromDb(serviceRule.start_time),
      formatTimeFromDb(serviceRule.end_time)
    )
    if (!merged.isOpen) return "service"
  }
  return "other"
}

export function exceptionDateKey(row: AvailabilityExceptionRecord): string {
  return String(row.exception_date).slice(0, 10)
}

const SYNTHETIC_PL_HOLIDAY_ID = "__pl_public_holiday__"

/**
 * Rekord wyjątku z bazy albo domyślne zamknięcie w ustawowe święto PL (gdy brak nadpisania firmy).
 */
export function resolveBookingException(
  dbException: AvailabilityExceptionRecord | null | undefined,
  cellDate: Date,
): AvailabilityExceptionRecord | null | undefined {
  if (dbException) return dbException
  if (isPolishPublicHoliday(cellDate)) {
    return {
      id: SYNTHETIC_PL_HOLIDAY_ID,
      business_id: "",
      exception_date: toLocalDateKey(cellDate),
      is_closed: true,
      start_time: null,
      end_time: null,
      reason: null,
    }
  }
  return undefined
}
