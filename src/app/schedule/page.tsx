"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { ScheduleFreeSlotsPanel } from "@/components/schedule/schedule-free-slots-panel"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { APPOINTMENT_ROW_STATUS_ORDER } from "@/lib/appointments/appointment-status-order"
import { fetchMergedAppointments, updateAppointmentStatus } from "@/lib/appointments/appointments-store"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { bookingNeedsAction } from "@/lib/bookings/booking-needs-action"
import { getAvailabilityRules } from "@/lib/availability/availability-store"
import { getPolishHolidayDisplayName } from "@/lib/calendar/polish-holidays"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  calendarEntriesToBookedSlots,
  computePanelFreeSlotsForMonth,
} from "@/lib/schedule/compute-panel-free-slots"
import { loadPanelFreeSlotsContext } from "@/lib/schedule/load-panel-free-slots-context"
import { getStaffForBusiness } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

type CalendarEntry = {
  id: string
  appointment_date: string
  appointment_time: string
  client_name: string
  client_phone: string
  service_name: string
  staff_id: string | null
  staff_name: string | null
  status: AppointmentStatus
  customer_note: string | null
  internal_note: string | null
  reminder_status: string | null
  second_reminder_status: string | null
  reminder_sent_at: string | null
}

type ViewFilter = "all" | "active" | "cancelled" | "pending" | "confirmed"

const DAY_PREVIEW_LIMIT = 4
const SLOT_DURATION_OPTIONS = [15, 30, 45, 60] as const

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
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
  if (raw === "pending") return "pending"
  if (raw === "confirmed") return "confirmed"
  if (raw === "cancelled") return "cancelled"
  if (raw === "no_show") return "no_show"
  return "booked"
}

function formatHm(raw: string): string {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return "00:00"
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`
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

function toAppointmentForNeedsAction(row: CalendarEntry): Appointment {
  return {
    id: `sb-${row.id}`,
    clientName: row.client_name,
    phone: row.client_phone,
    serviceLabel: row.service_name,
    startsAt: `${row.appointment_date}T${formatHm(row.appointment_time)}:00`,
    status: normalizeStatus(row.status),
    staffId: row.staff_id ?? undefined,
    staffName: row.staff_name ?? undefined,
    reminderStatus: row.reminder_status,
    secondReminderStatus: row.second_reminder_status,
    reminderSentAt: row.reminder_sent_at,
  }
}

function matchesViewFilter(row: CalendarEntry, filter: ViewFilter): boolean {
  const status = normalizeStatus(row.status)
  if (filter === "active") return status !== "cancelled"
  if (filter === "cancelled") return status === "cancelled"
  if (filter === "pending") return status === "pending"
  if (filter === "confirmed") return status === "confirmed"
  return true
}

function BookingStatusBadge({ row }: { row: CalendarEntry }) {
  if (bookingNeedsAction(toAppointmentForNeedsAction(row))) {
    return (
      <span className="inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:text-amber-100">
        Wymaga reakcji
      </span>
    )
  }
  return <StatusBadge status={normalizeStatus(row.status)} />
}

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
  const [viewFilter, setViewFilter] = React.useState<ViewFilter>("all")
  const [detailDate, setDetailDate] = React.useState<string | null>(null)
  const [refreshTick, setRefreshTick] = React.useState(0)
  const [statusNotice, setStatusNotice] = React.useState("")
  const [slotDurationMinutes, setSlotDurationMinutes] = React.useState(30)
  const [freeSlotsLoading, setFreeSlotsLoading] = React.useState(true)
  const [freeSlotsContext, setFreeSlotsContext] = React.useState<
    Awaited<ReturnType<typeof loadPanelFreeSlotsContext>> | null
  >(null)

  React.useEffect(() => {
    if (!statusNotice) return
    const tid = window.setTimeout(() => setStatusNotice(""), 2500)
    return () => window.clearTimeout(tid)
  }, [statusNotice])

  const changeScheduleBookingStatus = React.useCallback(
    (appointmentUiId: string, status: AppointmentStatus) => {
      void (async () => {
        const ok = await updateAppointmentStatus(appointmentUiId, status, {
          lastUpdatedBy: "business",
          lastStatusChangeSource: "manual",
        })
        if (!ok) return
        setStatusNotice(t("appointments.statusUpdated"))
      })()
    },
    [t]
  )

  const mapAppointmentToEntry = React.useCallback((row: Appointment): CalendarEntry | null => {
    const dt = new Date(row.startsAt)
    if (Number.isNaN(dt.getTime())) return null
    return {
      id: row.id,
      appointment_date: dateKey(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()),
      appointment_time: `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`,
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
    window.addEventListener("pw-availability", forceReload)
    window.addEventListener("pw-staff", forceReload)
    window.addEventListener("focus", forceReload)
    return () => {
      window.removeEventListener("pw-bookings", forceReload)
      window.removeEventListener("pw-public-bookings", forceReload)
      window.removeEventListener("pw-manual-appointments", forceReload)
      window.removeEventListener("pw-availability", forceReload)
      window.removeEventListener("pw-staff", forceReload)
      window.removeEventListener("focus", forceReload)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(false)
      try {
        const client = getBrowserClient()
        if (!client || !isSupabaseConfigured()) {
          if (!cancelled) {
            setBookings([])
            setStaffMembers([])
          }
          return
        }
        const [mergedAppointments, staff] = await Promise.all([
          fetchMergedAppointments(),
          access.businessId ? getStaffForBusiness(client, access.businessId) : Promise.resolve([]),
        ])
        const monthEntries = mergedAppointments
          .map(mapAppointmentToEntry)
          .filter((row): row is CalendarEntry => row != null)
          .filter((row) => {
            const year = Number(row.appointment_date.slice(0, 4))
            const month = Number(row.appointment_date.slice(5, 7))
            return year === ym.year && month === ym.month
          })
        if (!cancelled) {
          setBookings(monthEntries)
          setStaffMembers(staff)
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.info("[schedule.calendar.bookings.error]", {
            message: error instanceof Error ? error.message : "unknown_error",
          })
        }
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ym, access.businessId, mapAppointmentToEntry, refreshTick])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setFreeSlotsLoading(true)
      try {
        const client = getBrowserClient()
        const loaded = await loadPanelFreeSlotsContext(
          client,
          access.businessId,
          staffMembers,
          ym.year,
          ym.month,
        )
        if (cancelled) return
        if (loaded) {
          setFreeSlotsContext(loaded)
          return
        }
        const availability = await getAvailabilityRules(client, access.businessId ?? null)
        if (!cancelled) {
          setFreeSlotsContext({
            businessAvailability: availability,
            businessExceptionsByDate: new Map(),
            bookedSlots: [],
            staffContexts: new Map(),
          })
        }
      } catch {
        if (!cancelled) setFreeSlotsContext(null)
      } finally {
        if (!cancelled) setFreeSlotsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ym, access.businessId, staffMembers, refreshTick])

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
      .filter((row) => matchesViewFilter(row, viewFilter))
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
  }, [bookings, viewFilter, effectivePersonFilter])

  React.useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.info("[schedule.calendar.bookings]", {
        month: `${ym.year}-${pad2(ym.month)}`,
        count: filteredBookings.length,
        filters: { personFilter: effectivePersonFilter || "all", viewFilter },
      })
    }
  }, [ym, filteredBookings.length, effectivePersonFilter, viewFilter])

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
    [detailDate, bookingsByDate]
  )

  const freeSlotsList = React.useMemo(() => {
    if (!freeSlotsContext) return []
    const booked =
      freeSlotsContext.bookedSlots.length > 0
        ? freeSlotsContext.bookedSlots
        : calendarEntriesToBookedSlots(bookings)
    return computePanelFreeSlotsForMonth({
      year: ym.year,
      month: ym.month,
      durationMinutes: slotDurationMinutes,
      businessAvailability: freeSlotsContext.businessAvailability,
      businessExceptionsByDate: freeSlotsContext.businessExceptionsByDate,
      bookedSlots: booked,
      staffMembers,
      staffContexts: freeSlotsContext.staffContexts,
      personFilterStaffId: effectivePersonFilter || null,
    })
  }, [
    freeSlotsContext,
    bookings,
    ym.year,
    ym.month,
    slotDurationMinutes,
    staffMembers,
    effectivePersonFilter,
  ])

  const freeSlotsByDate = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const day of freeSlotsList) map.set(day.date, day.times)
    return map
  }, [freeSlotsList])

  const formatFreeSlotDayHeading = React.useCallback(
    (dateKey: string) =>
      formatters.dayLong.format(
        new Date(
          Number(dateKey.slice(0, 4)),
          Number(dateKey.slice(5, 7)) - 1,
          Number(dateKey.slice(8, 10)),
        ),
      ),
    [formatters.dayLong],
  )

  const detailFreeTimes = detailDate ? freeSlotsByDate.get(detailDate) ?? [] : []
  React.useEffect(() => {
    if (!detailDate) return
    if (process.env.NODE_ENV === "development") {
      console.info("[schedule.day.bookings]", { date: detailDate, bookings: detailRows })
    }
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="sch-view" className="text-xs text-muted-foreground">
                Widok
              </Label>
              <select
                id="sch-view"
                className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
                value={viewFilter}
                onChange={(e) => setViewFilter(e.target.value as ViewFilter)}
              >
                <option value="all">Wszyscy</option>
                <option value="active">Tylko aktywne</option>
                <option value="cancelled">Tylko anulowane</option>
                <option value="pending">Tylko do potwierdzenia</option>
                <option value="confirmed">Tylko potwierdzone</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie danych...</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">Nie udało się załadować danych grafiku.</p>
        ) : (
          <>
            <ScheduleFreeSlotsPanel
              className="mb-5"
              monthLabel={formatters.monthYear.format(new Date(ym.year, ym.month - 1, 1))}
              durationMinutes={slotDurationMinutes}
              onDurationChange={setSlotDurationMinutes}
              durationOptions={SLOT_DURATION_OPTIONS}
              loading={freeSlotsLoading || loading}
              days={freeSlotsList}
              selectedDate={detailDate}
              onSelectDate={setDetailDate}
              formatDayHeading={formatFreeSlotDayHeading}
            />
            <div className="mb-1 hidden grid-cols-7 gap-1 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground md:grid">
              {weekdayHeader.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-1.5">
              {weekMondayFirstCells(ym.year, ym.month).map((dayNum, idx) => {
                if (dayNum == null) {
                  return <div key={`empty-${idx}`} className="hidden min-h-[8.5rem] rounded-xl border border-transparent bg-muted/5 md:block" />
                }
                const key = dateKey(ym.year, ym.month, dayNum)
                const holidayLabel = getPolishHolidayDisplayName(
                  new Date(ym.year, ym.month - 1, dayNum),
                  language === "en" ? "en" : "pl"
                )
                const rows = bookingsByDate.get(key) ?? []
                const dayFreeTimes = freeSlotsByDate.get(key)
                const preview = rows.slice(0, DAY_PREVIEW_LIMIT)
                const more = Math.max(0, rows.length - DAY_PREVIEW_LIMIT)
                const isToday = key === todayKey
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setDetailDate(key)}
                    className={cn(
                      "flex min-h-[8.5rem] flex-col rounded-xl border bg-card p-2 text-left shadow-sm transition-colors hover:bg-muted/20",
                      isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{dayNum}</p>
                        <p className="text-[11px] text-muted-foreground">{visitCountLabel(rows.length)}</p>
                        {dayFreeTimes && dayFreeTimes.length > 0 ? (
                          <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                            {t("schedule.freeSlotsCount").replace(
                              "{count}",
                              String(dayFreeTimes.length),
                            )}
                          </p>
                        ) : null}
                      </div>
                      {holidayLabel ? (
                        <span
                          title={holidayLabel}
                          className="max-w-[10rem] truncate rounded bg-amber-500/15 px-1.5 py-0.5 text-right text-[10px] font-medium leading-tight text-amber-900 dark:text-amber-100"
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
                              "rounded-md border border-border/70 px-1.5 py-1 text-[11px] leading-tight",
                              normalizeStatus(row.status) === "cancelled" && "opacity-60"
                            )}
                          >
                            <p className="truncate font-medium text-foreground">
                              {formatHm(row.appointment_time)} — {row.client_name}
                            </p>
                            <p className="truncate text-muted-foreground">
                              {row.service_name} / {(row.staff_name?.trim() || (row.staff_id ? staffNameById.get(row.staff_id) : "")) || "Nie przypisano"}
                            </p>
                          </li>
                        ))
                      )}
                      {more > 0 ? <li className="text-[11px] text-primary">+{more} więcej</li> : null}
                    </ul>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </PageShell>

      <Sheet open={detailDate != null} onOpenChange={(open) => !open && setDetailDate(null)}>
        <SheetContent className="premium-scrollbar flex w-full max-w-xl flex-col" showCloseButton>
          <SheetHeader className="border-b border-border/70 text-left">
            <SheetTitle>
              Szczegóły dnia
              {detailDate
                ? ` — ${formatters.dayLong.format(
                    new Date(
                      Number(detailDate.slice(0, 4)),
                      Number(detailDate.slice(5, 7)) - 1,
                      Number(detailDate.slice(8, 10))
                    )
                  )}`
                : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
                {t("schedule.freeSlotsDayHeading")}
              </p>
              {detailFreeTimes.length > 0 ? (
                <p className="mt-2 text-sm leading-relaxed tabular-nums text-foreground">
                  {detailFreeTimes.join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{t("schedule.freeSlotsDayNone")}</p>
              )}
            </div>
            {detailRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zaplanowanych wizyt</p>
            ) : (
              detailRows.map((row) => {
                const isCancelled = normalizeStatus(row.status) === "cancelled"
                return (
                <div
                  key={row.id}
                  className={cn(
                    "rounded-xl border border-border p-3",
                    isCancelled && "opacity-70"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {formatHm(row.appointment_time)} · {row.client_name}
                    </p>
                    <BookingStatusBadge row={row} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.service_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(row.staff_name?.trim() || (row.staff_id ? staffNameById.get(row.staff_id) : "")) || "Nie przypisano osoby"}
                  </p>
                  {row.client_phone?.trim() ? (
                    <p className="mt-1 text-xs text-muted-foreground">Tel: {row.client_phone.trim()}</p>
                  ) : null}
                  {(row.customer_note?.trim() || row.internal_note?.trim()) ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Notatka: {row.customer_note?.trim() || row.internal_note?.trim()}
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      "mt-2 grid w-full gap-1.5",
                      isCancelled ? "grid-cols-1" : "grid-cols-3"
                    )}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-full min-w-0 whitespace-nowrap px-2 text-xs sm:px-2.5"
                      asChild
                    >
                      <Link href="/appointments">Otwórz wizytę</Link>
                    </Button>
                    {!isCancelled ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 w-full min-w-0 whitespace-nowrap px-2 text-xs sm:px-2.5"
                          asChild
                        >
                          <Link href={`/appointments?edit=${encodeURIComponent(row.id)}`}>
                            Edytuj wizytę
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-full min-w-0 whitespace-nowrap px-2 text-xs sm:px-2.5"
                            >
                              {t("appointments.changeStatusAction")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56">
                            <div className="px-2 pt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                              {t("appointments.manualStatusChange")}
                            </div>
                            <div className="px-2 py-1 text-xs text-muted-foreground">
                              {t("appointments.chooseStatus")}
                            </div>
                            {APPOINTMENT_ROW_STATUS_ORDER.map((status) => (
                              <DropdownMenuItem
                                key={status}
                                onClick={() => changeScheduleBookingStatus(row.id, status)}
                              >
                                {t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked")}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : null}
                  </div>
                </div>
                )
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}
