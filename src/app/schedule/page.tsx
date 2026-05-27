"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { DayScheduleModal } from "@/components/schedule/day-schedule-modal"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cancelAppointmentFromRemove } from "@/lib/appointments/cancel-appointment-from-remove"
import { fetchMergedAppointments, updateAppointmentStatus } from "@/lib/appointments/appointments-store"
import { SB_BOOKING_PREFIX } from "@/lib/bookings/bookings-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getPublicBookings } from "@/lib/bookings/public-bookings"
import { getPolishHolidayDisplayName } from "@/lib/calendar/polish-holidays"
import { useTranslations } from "@/lib/i18n/use-translations"
import { SCHEDULE_BOARD_DEFAULT_DURATION_MINUTES } from "@/lib/schedule/schedule-day-types"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { formatHm } from "@/lib/schedule/schedule-day-board"
import { getStaffForBusiness } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

type CalendarEntry = ScheduleDayEntry & {
  client_phone: string
  customer_note: string | null
  internal_note: string | null
  reminder_status: string | null
  second_reminder_status: string | null
  reminder_sent_at: string | null
}

const DAY_PREVIEW_LIMIT = 3
const SCHEDULE_MONTH_CACHE_TTL_MS = 30_000
const SCHEDULE_STAFF_CACHE_TTL_MS = 5 * 60_000
const SCHEDULE_BOOKING_SELECT =
  "id,appointment_date,appointment_time,client_name,client_phone,service_name,service_duration_minutes,staff_id,staff_name,status,customer_note,business_note,internal_note,reminder_status,first_reminder_status,second_reminder_status,reminder_sent_at,first_reminder_sent_at"

type ScheduleBookingRow = Pick<
  Tables<"bookings">,
  | "id"
  | "appointment_date"
  | "appointment_time"
  | "client_name"
  | "client_phone"
  | "service_name"
  | "service_duration_minutes"
  | "staff_id"
  | "staff_name"
  | "status"
  | "customer_note"
  | "business_note"
  | "internal_note"
  | "reminder_status"
  | "first_reminder_status"
  | "second_reminder_status"
  | "reminder_sent_at"
  | "first_reminder_sent_at"
>

const scheduleMonthCache = new Map<string, { loadedAt: number; entries: CalendarEntry[] }>()
const scheduleStaffCache = new Map<string, { loadedAt: number; staff: StaffMember[] }>()

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function scheduleMonthCacheKey(businessId: string | null | undefined, year: number, month: number): string {
  return `${businessId?.trim() || "local"}:${year}-${pad2(month)}`
}

function readScheduleMonthCache(key: string): CalendarEntry[] | null {
  const cached = scheduleMonthCache.get(key)
  if (!cached) return null
  if (Date.now() - cached.loadedAt > SCHEDULE_MONTH_CACHE_TTL_MS) {
    scheduleMonthCache.delete(key)
    return null
  }
  return cached.entries
}

function writeScheduleMonthCache(key: string, entries: CalendarEntry[]): void {
  scheduleMonthCache.set(key, { loadedAt: Date.now(), entries })
}

function patchScheduleMonthCacheStatus(appointmentUiId: string, status: AppointmentStatus): void {
  for (const [key, cached] of scheduleMonthCache.entries()) {
    let changed = false
    const entries = cached.entries.map((row) => {
      if (row.id !== appointmentUiId) return row
      changed = true
      return { ...row, status }
    })
    if (changed) scheduleMonthCache.set(key, { ...cached, entries })
  }
}

function readScheduleStaffCache(businessId: string): StaffMember[] | null {
  const cached = scheduleStaffCache.get(businessId)
  if (!cached) return null
  if (Date.now() - cached.loadedAt > SCHEDULE_STAFF_CACHE_TTL_MS) {
    scheduleStaffCache.delete(businessId)
    return null
  }
  return cached.staff
}

function writeScheduleStaffCache(businessId: string, staff: StaffMember[]): void {
  scheduleStaffCache.set(businessId, { loadedAt: Date.now(), staff })
}

function weekMondayFirstCells(year: number, month: number): (number | null)[] {
  const dim = daysInMonth(year, month)
  const first = new Date(year, month - 1, 1)
  const dow = first.getDay()
  const monOffset = dow === 0 ? 6 : dow - 1
  const cells: (number | null)[] = []
  for (let i = 0; i < monOffset; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function normalizeStatus(raw: string): AppointmentStatus {
  if (raw === "cancelled") return "cancelled"
  if (raw === "no_show") return "no_show"
  if (raw === "completed") return "completed"
  if (raw === "confirmed" || raw === "pending" || raw === "booked") return "confirmed"
  return "confirmed"
}

function mapScheduleBookingRowToEntry(row: ScheduleBookingRow): CalendarEntry {
  return {
    id: `${SB_BOOKING_PREFIX}${row.id}`,
    appointment_date: String(row.appointment_date).slice(0, 10),
    appointment_time: formatHm(String(row.appointment_time ?? "")),
    duration_minutes: Math.max(
      15,
      Math.floor(Number(row.service_duration_minutes) || SCHEDULE_BOARD_DEFAULT_DURATION_MINUTES),
    ),
    client_name: row.client_name?.trim() || "Klient",
    client_phone: row.client_phone?.trim() || "",
    service_name: row.service_name?.trim() || "Usługa",
    staff_id: row.staff_id?.trim() || null,
    staff_name: row.staff_name?.trim() || null,
    status: normalizeStatus(String(row.status ?? "confirmed")),
    customer_note: row.customer_note ?? null,
    internal_note: row.internal_note ?? row.business_note ?? null,
    reminder_status: row.reminder_status ?? row.first_reminder_status ?? null,
    second_reminder_status: row.second_reminder_status ?? null,
    reminder_sent_at: row.reminder_sent_at ?? row.first_reminder_sent_at ?? null,
  }
}

async function fetchScheduleMonthEntries(
  client: NonNullable<ReturnType<typeof getBrowserClient>>,
  businessId: string,
  year: number,
  month: number,
): Promise<CalendarEntry[]> {
  const lastDay = daysInMonth(year, month)
  const fromDate = `${year}-${pad2(month)}-01`
  const toDate = `${year}-${pad2(month)}-${pad2(lastDay)}`
  const { data, error } = await client
    .from("bookings")
    .select(SCHEDULE_BOOKING_SELECT)
    .eq("business_id", businessId)
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .order("appointment_date", { ascending: true })
    .order("appointment_time", { ascending: true })
  if (error || !data) return []
  return (data as ScheduleBookingRow[]).map(mapScheduleBookingRowToEntry)
}

function resolveDurationMinutes(row: Appointment): number {
  if (row.id.startsWith("pb-")) {
    const publicId = row.id.slice(3)
    const pb = getPublicBookings().find((b) => b.id === publicId)
    if (pb?.serviceDurationMinutes && pb.serviceDurationMinutes > 0) {
      return pb.serviceDurationMinutes
    }
  }
  return SCHEDULE_BOARD_DEFAULT_DURATION_MINUTES
}

function compareBookings(a: CalendarEntry, b: CalendarEntry): number {
  const aCancelled = normalizeStatus(a.status) === "cancelled"
  const bCancelled = normalizeStatus(b.status) === "cancelled"
  if (aCancelled !== bCancelled) return aCancelled ? 1 : -1
  return formatHm(a.appointment_time).localeCompare(formatHm(b.appointment_time))
}

function visitCountLabel(count: number): string {
  if (count === 1) return "1 wizyta"
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${count} wizyty`
  return `${count} wizyt`
}

const STATUS_MENU_ORDER: AppointmentStatus[] = ["confirmed", "no_show", "completed"]

export default function SchedulePage() {
  const { t, language } = useTranslations()
  const access = useBusinessAccess()
  const [ym, setYm] = React.useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [bookings, setBookings] = React.useState<CalendarEntry[]>([])
  const [staffMembers, setStaffMembers] = React.useState<StaffMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [linkedStaffId, setLinkedStaffId] = React.useState<string | null | undefined>(undefined)
  const [personFilter, setPersonFilter] = React.useState("")
  const [detailDate, setDetailDate] = React.useState<string | null>(null)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [statusNotice, setStatusNotice] = React.useState("")
  const [cancellingId, setCancellingId] = React.useState<string | null>(null)
  const cancellingIdRef = React.useRef<string | null>(null)
  const scheduleBookingsLoadedRef = React.useRef(false)

  React.useEffect(() => {
    if (!statusNotice) return
    const tid = window.setTimeout(() => setStatusNotice(""), 2500)
    return () => window.clearTimeout(tid)
  }, [statusNotice])

  const refreshScheduleData = React.useCallback(() => {
    setRefreshTick((v) => v + 1)
    window.dispatchEvent(new Event("pw-bookings"))
  }, [])

  const patchScheduleBookingStatus = React.useCallback((appointmentUiId: string, status: AppointmentStatus) => {
    patchScheduleMonthCacheStatus(appointmentUiId, status)
    setBookings((prev) =>
      prev.map((row) => (row.id === appointmentUiId ? { ...row, status } : row)),
    )
  }, [])

  const changeScheduleBookingStatus = React.useCallback(
    (appointmentUiId: string, status: AppointmentStatus) => {
      void (async () => {
        const ok = await updateAppointmentStatus(appointmentUiId, status, {
          lastUpdatedBy: "business",
          lastStatusChangeSource: "manual",
        })
        if (!ok) return
        patchScheduleBookingStatus(appointmentUiId, status)
        setStatusNotice(t("appointments.statusUpdated"))
        window.dispatchEvent(new Event("pw-bookings"))
      })()
    },
    [patchScheduleBookingStatus, t]
  )

  const cancelScheduleVisit = React.useCallback(
    (appointmentUiId: string) => {
      if (cancellingIdRef.current === appointmentUiId) return
      void (async () => {
        cancellingIdRef.current = appointmentUiId
        setCancellingId(appointmentUiId)
        try {
          const cancelResult = await cancelAppointmentFromRemove(
            appointmentUiId,
            language === "en" ? "en" : "pl",
            true,
          )
          if (!cancelResult.ok) {
            setStatusNotice(t("appointments.cancelVisitCouldNotComplete"))
            return
          }
          patchScheduleBookingStatus(appointmentUiId, "cancelled")
          setStatusNotice(t("appointments.statusUpdated"))
          window.dispatchEvent(new Event("pw-bookings"))
        } finally {
          cancellingIdRef.current = null
          setCancellingId(null)
        }
      })()
    },
    [language, patchScheduleBookingStatus, t],
  )

  const mapAppointmentToEntry = React.useCallback((row: Appointment): CalendarEntry | null => {
    const dt = new Date(row.startsAt)
    if (Number.isNaN(dt.getTime())) return null
    return {
      id: row.id,
      appointment_date: dateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()),
      appointment_time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
      duration_minutes: resolveDurationMinutes(row),
      client_name: row.clientName || "Klient",
      client_phone: row.phone || "",
      service_name: row.serviceLabel || "Usługa",
      staff_id: row.staffId ?? null,
      staff_name: row.staffName ?? null,
      status: normalizeStatus(row.status),
      customer_note: row.customerNote ?? null,
      internal_note: row.internalNote ?? row.businessNote ?? null,
      reminder_status: row.reminderStatus ?? row.firstReminderStatus ?? null,
      second_reminder_status: row.secondReminderStatus ?? null,
      reminder_sent_at: row.reminderSentAt ?? row.firstReminderSentAt ?? null,
    }
  }, [])

  const formatters = React.useMemo(() => {
    const loc = language === "en" ? "en-GB" : "pl-PL"
    return {
      monthYear: new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }),
      dayLong: new Intl.DateTimeFormat(loc, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      weekdayShort: new Intl.DateTimeFormat(loc, { weekday: "short" }),
    }
  }, [language])

  const todayKey = React.useMemo(() => {
    const n = new Date()
    return dateKey(n.getFullYear(), n.getMonth() + 1, n.getDate())
  }, [])

  const weekdayHeader = React.useMemo(() => {
    const start = new Date(2024, 0, 8)
    const out: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      out.push(formatters.weekdayShort.format(d))
    }
    return out
  }, [formatters])

  React.useEffect(() => {
    const client = getBrowserClient()
    const businessId = access.businessId
    if (!client || !isSupabaseConfigured() || !businessId || access.effectiveRole !== "staff") return
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user || cancelled) return
      const { data } = await client
        .from("business_members")
        .select("staff_member_id")
        .eq("business_id", businessId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!cancelled) setLinkedStaffId(data?.staff_member_id?.trim() || null)
    })()
    return () => {
      cancelled = true
    }
  }, [access.businessId, access.effectiveRole])

  React.useEffect(() => {
    const forceReload = () => setRefreshTick((v) => v + 1)
    window.addEventListener("pw-bookings", forceReload)
    window.addEventListener("pw-public-bookings", forceReload)
    window.addEventListener("pw-manual-appointments", forceReload)
    return () => {
      window.removeEventListener("pw-bookings", forceReload)
      window.removeEventListener("pw-public-bookings", forceReload)
      window.removeEventListener("pw-manual-appointments", forceReload)
    }
  }, [])

  React.useEffect(() => {
    if (!access.ready) return
    let cancelled = false
    void (async () => {
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured() || !access.businessId) {
        if (!cancelled) setStaffMembers([])
        return
      }
      const cached = readScheduleStaffCache(access.businessId)
      if (cached && !cancelled) {
        setStaffMembers(cached)
      }
      try {
        const staff = await getStaffForBusiness(client, access.businessId)
        writeScheduleStaffCache(access.businessId, staff)
        if (!cancelled) setStaffMembers(staff)
      } catch {
        if (!cancelled) setStaffMembers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access.ready, access.businessId])

  React.useEffect(() => {
    if (!access.ready) return
    let cancelled = false
    const cacheKey = scheduleMonthCacheKey(access.businessId, ym.year, ym.month)
    const cached = readScheduleMonthCache(cacheKey)
    const showBlockingLoader = !scheduleBookingsLoadedRef.current && cached == null
    if (cached) {
      setBookings(cached)
      scheduleBookingsLoadedRef.current = true
      setLoading(false)
    }
    if (showBlockingLoader) setLoading(true)
    setLoadError(false)
    void (async () => {
      try {
        const client = getBrowserClient()
        if (!client || !isSupabaseConfigured()) {
          if (!cancelled) setBookings([])
          return
        }
        let monthAppointments: Awaited<ReturnType<typeof fetchMergedAppointments>> = []
        if (access.businessId) {
          const monthEntries = await fetchScheduleMonthEntries(
            client,
            access.businessId,
            ym.year,
            ym.month,
          )
          writeScheduleMonthCache(cacheKey, monthEntries)
          if (!cancelled) {
            setBookings(monthEntries)
            scheduleBookingsLoadedRef.current = true
          }
          return
        } else {
          const merged = await fetchMergedAppointments({ businessId: access.businessId })
          monthAppointments = merged.filter((row) => {
            const dt = new Date(row.startsAt)
            if (Number.isNaN(dt.getTime())) return false
            return dt.getFullYear() === ym.year && dt.getMonth() + 1 === ym.month
          })
        }
        const monthEntries = monthAppointments
          .map(mapAppointmentToEntry)
          .filter((row): row is CalendarEntry => row != null)
        writeScheduleMonthCache(cacheKey, monthEntries)
        if (!cancelled) {
          setBookings(monthEntries)
          scheduleBookingsLoadedRef.current = true
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.info("[schedule.calendar.bookings.error]", {
            message: error instanceof Error ? error.message : "unknown_error",
          })
        }
        if (!cancelled && showBlockingLoader) setLoadError(true)
      } finally {
        if (!cancelled && showBlockingLoader) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ym, access.ready, access.businessId, mapAppointmentToEntry, refreshTick])

  const visibleStaff = React.useMemo(() => {
    if (access.effectiveRole !== "staff") return staffMembers
    if (!linkedStaffId) return []
    return staffMembers.filter((row) => row.id === linkedStaffId)
  }, [staffMembers, linkedStaffId, access.effectiveRole])

  const effectivePersonFilter =
    access.effectiveRole === "staff" && linkedStaffId ? linkedStaffId : personFilter

  const staffNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const row of staffMembers) {
      map.set(row.id, row.name)
    }
    return map
  }, [staffMembers])

  const filteredBookings = React.useMemo(() => {
    const out = bookings
      .filter((row) => normalizeStatus(row.status) !== "cancelled")
      .filter((row) => {
        if (!effectivePersonFilter) return true
        return (row.staff_id ?? "") === effectivePersonFilter
      })
    out.sort((a, b) => {
      const byDate = a.appointment_date.localeCompare(b.appointment_date)
      if (byDate !== 0) return byDate
      return compareBookings(a, b)
    })
    return out
  }, [bookings, effectivePersonFilter])

  const bookingsByDate = React.useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const row of filteredBookings) {
      const arr = map.get(row.appointment_date) ?? []
      arr.push(row)
      map.set(row.appointment_date, arr)
    }
    for (const rows of map.values()) rows.sort(compareBookings)
    return map
  }, [filteredBookings])

  const detailRows = React.useMemo(
    () => (detailDate ? bookingsByDate.get(detailDate) ?? [] : []),
    [detailDate, bookingsByDate],
  )

  React.useEffect(() => {
    if (!detailDate || process.env.NODE_ENV !== "development") return
    console.info("[schedule.day.bookings]", { date: detailDate, bookings: detailRows })
  }, [detailDate, detailRows])

  const goPrev = () => setYm((p) => (p.month === 1 ? { year: p.year - 1, month: 12 } : { year: p.year, month: p.month - 1 }))
  const goNext = () => setYm((p) => (p.month === 12 ? { year: p.year + 1, month: 1 } : { year: p.year, month: p.month + 1 }))

  if (access.ready && access.effectiveRole === "staff" && linkedStaffId === null && isSupabaseConfigured()) {
    return (
      <AppShell title="Grafik" pageDescription="Rezerwacje w miesiącu">
        <PageShell>
          <p className="text-sm text-muted-foreground">{t("schedule.accessDeniedStaff")}</p>
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell title="Grafik" pageDescription="Rezerwacje w miesiącu">
      <PageShell>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </Button>
            <p className="min-w-[12rem] text-center text-sm font-semibold capitalize">
              {formatters.monthYear.format(new Date(ym.year, ym.month - 1, 1))}
            </p>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={goNext}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sch-person" className="text-xs text-muted-foreground">
                Osoba
              </Label>
              <select
                id="sch-person"
                className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                disabled={access.effectiveRole === "staff"}
              >
                <option value="">Wszystkie osoby</option>
                {visibleStaff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {statusNotice ? (
          <p className="mb-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm text-foreground">
            {statusNotice}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie danych...</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">Nie udało się załadować danych grafiku.</p>
        ) : (
          <>
            <div className="mb-1.5 hidden grid-cols-7 gap-1.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
              {weekdayHeader.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-7 md:gap-2" data-tour="schedule-month">
              {weekMondayFirstCells(ym.year, ym.month).map((dayNum, idx) => {
                if (dayNum == null) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="hidden min-h-[6.75rem] rounded-xl border border-transparent bg-muted/5 md:block"
                    />
                  )
                }
                const key = dateKey(ym.year, ym.month, dayNum)
                const holidayLabel = getPolishHolidayDisplayName(
                  new Date(ym.year, ym.month - 1, dayNum),
                  language === "en" ? "en" : "pl",
                )
                const rows = bookingsByDate.get(key) ?? []
                const preview = rows.slice(0, DAY_PREVIEW_LIMIT)
                const more = Math.max(0, rows.length - DAY_PREVIEW_LIMIT)
                const isToday = key === todayKey
                const hasVisits = rows.length > 0
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setDetailDate(key)}
                    className={cn(
                      "flex min-h-[6.75rem] flex-col rounded-xl border p-2 text-left shadow-sm transition-colors",
                      hasVisits
                        ? "border-yellow-300/90 bg-yellow-50 hover:bg-yellow-100/90 dark:border-yellow-700 dark:bg-yellow-950/50 dark:hover:bg-yellow-950/70"
                        : "border-border/80 bg-card hover:bg-muted/25",
                      isToday && "ring-1 ring-primary/20",
                      isToday && (hasVisits ? "border-primary/35" : "border-primary/40"),
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-foreground">{dayNum}</p>
                        <p className="text-xs text-muted-foreground">{visitCountLabel(rows.length)}</p>
                      </div>
                      {holidayLabel ? (
                        <span
                          title={holidayLabel}
                          className="max-w-[6rem] truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-amber-900 dark:text-amber-100"
                        >
                          {holidayLabel}
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-1.5 space-y-1 overflow-hidden">
                      {preview.length === 0 ? (
                        <li className="text-xs text-muted-foreground">Brak wizyt</li>
                      ) : (
                        preview.map((row) => (
                          <li
                            key={row.id}
                            className={cn(
                              "rounded-md border border-border/60 bg-muted/20 px-1.5 py-1 text-xs leading-snug",
                              normalizeStatus(row.status) === "cancelled" && "opacity-55 line-through",
                            )}
                          >
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatHm(row.appointment_time)}
                            </span>{" "}
                            <span className="font-medium text-foreground">{row.client_name}</span>
                            {row.service_name ? (
                              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                {row.service_name}
                              </span>
                            ) : null}
                          </li>
                        ))
                      )}
                      {more > 0 ? (
                        <li className="text-xs font-medium text-primary">+{more} więcej</li>
                      ) : null}
                    </ul>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </PageShell>

      <DayScheduleModal
        open={detailDate != null}
        onOpenChange={(open) => {
          if (!open) setDetailDate(null)
        }}
        dayTitle={
          detailDate
            ? formatters.dayLong.format(
                new Date(
                  Number(detailDate.slice(0, 4)),
                  Number(detailDate.slice(5, 7)) - 1,
                  Number(detailDate.slice(8, 10)),
                ),
              )
            : ""
        }
        visitSummary={visitCountLabel(detailRows.length)}
        entries={detailRows}
        staffMembers={visibleStaff.length > 0 ? visibleStaff : staffMembers}
        staffNameById={staffNameById}
        cancellingId={cancellingId}
        statusMenuOrder={STATUS_MENU_ORDER}
        visitCountLabel={visitCountLabel}
        statusLabel={(status) =>
          t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked")
        }
        changeStatusLabel={t("appointments.changeStatusAction")}
        cancelLabel={t("appointments.cancelVisit")}
        staffFallbackLabel={t("appointments.staffNotAssignedShort")}
        emptyLabel="Brak zaplanowanych wizyt"
        actionNotice={statusNotice}
        onChangeStatus={changeScheduleBookingStatus}
        onCancelVisit={cancelScheduleVisit}
      />
    </AppShell>
  )
}
