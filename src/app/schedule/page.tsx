"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
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
import { fetchCancelBookingByCompany } from "@/lib/bookings/cancel-booking-by-company-client"
import { unwrapSupabaseBookingAppointmentId } from "@/lib/bookings/bookings-store"
import { getPolishHolidayDisplayName } from "@/lib/calendar/polish-holidays"
import { useTranslations } from "@/lib/i18n/use-translations"
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

const DAY_PREVIEW_LIMIT = 3

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
  if (raw === "cancelled") return "cancelled"
  if (raw === "confirmed" || raw === "pending" || raw === "booked" || raw === "no_show") {
    return "confirmed"
  }
  return "confirmed"
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

function matchesViewFilter(row: CalendarEntry, filter: ViewFilter): boolean {
  const status = normalizeStatus(row.status)
  if (filter === "active") return status !== "cancelled"
  if (filter === "cancelled") return status === "cancelled"
  if (filter === "pending") return status === "confirmed"
  if (filter === "confirmed") return status === "confirmed"
  return true
}

const STATUS_MENU_ORDER = APPOINTMENT_ROW_STATUS_ORDER.filter((s) => s !== "cancelled")

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
  const [confirmCancelForId, setConfirmCancelForId] = React.useState<string | null>(null)
  const [cancellingId, setCancellingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!statusNotice) return
    const tid = window.setTimeout(() => setStatusNotice(""), 2500)
    return () => window.clearTimeout(tid)
  }, [statusNotice])

  const refreshScheduleData = React.useCallback(() => {
    setRefreshTick((v) => v + 1)
    window.dispatchEvent(new Event("pw-bookings"))
  }, [])

  const changeScheduleBookingStatus = React.useCallback(
    (appointmentUiId: string, status: AppointmentStatus) => {
      void (async () => {
        const ok = await updateAppointmentStatus(appointmentUiId, status, {
          lastUpdatedBy: "business",
          lastStatusChangeSource: "manual",
        })
        if (!ok) return
        setStatusNotice(t("appointments.statusUpdated"))
        refreshScheduleData()
      })()
    },
    [t, refreshScheduleData]
  )

  const cancelScheduleVisit = React.useCallback(
    (row: CalendarEntry) => {
      void (async () => {
        setCancellingId(row.id)
        try {
          const uuidSb = unwrapSupabaseBookingAppointmentId(row.id)
          if (uuidSb) {
            const cancelRes = await fetchCancelBookingByCompany(
              row.id,
              language === "en" ? "en" : "pl",
              true,
            )
            if (!cancelRes.ok) {
              setStatusNotice(t("appointments.cancelVisitCouldNotComplete"))
              return
            }
          } else {
            const ok = await updateAppointmentStatus(row.id, "cancelled", {
              lastUpdatedBy: "business",
              lastStatusChangeSource: "manual",
            })
            if (!ok) {
              setStatusNotice(t("appointments.cancelVisitCouldNotComplete"))
              return
            }
          }
          setConfirmCancelForId(null)
          setStatusNotice(t("appointments.statusUpdated"))
          refreshScheduleData()
        } finally {
          setCancellingId(null)
        }
      })()
    },
    [language, t, refreshScheduleData],
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
    window.addEventListener("pw-staff", forceReload)
    window.addEventListener("focus", forceReload)
    return () => {
      window.removeEventListener("pw-bookings", forceReload)
      window.removeEventListener("pw-public-bookings", forceReload)
      window.removeEventListener("pw-manual-appointments", forceReload)
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
    if (!detailDate) {
      setConfirmCancelForId(null)
      return
    }
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
                <option value="confirmed">Tylko potwierdzone</option>
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
            <div className="mb-1 hidden grid-cols-7 gap-1 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground md:grid">
              {weekdayHeader.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-1">
              {weekMondayFirstCells(ym.year, ym.month).map((dayNum, idx) => {
                if (dayNum == null) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="hidden min-h-[5.5rem] rounded-lg border border-transparent bg-muted/5 md:block"
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
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => setDetailDate(key)}
                    className={cn(
                      "flex min-h-[5.5rem] flex-col rounded-lg border bg-card p-1.5 text-left shadow-sm transition-colors hover:bg-muted/20",
                      isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">{dayNum}</p>
                        <p className="text-[10px] text-muted-foreground">{visitCountLabel(rows.length)}</p>
                      </div>
                      {holidayLabel ? (
                        <span
                          title={holidayLabel}
                          className="max-w-[5.5rem] truncate rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium leading-tight text-amber-900 dark:text-amber-100"
                        >
                          {holidayLabel}
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-1 space-y-0.5 overflow-hidden">
                      {preview.length === 0 ? (
                        <li className="text-[10px] text-muted-foreground">Brak wizyt</li>
                      ) : (
                        preview.map((row) => (
                          <li
                            key={row.id}
                            className={cn(
                              "truncate text-[10px] leading-snug",
                              normalizeStatus(row.status) === "cancelled" && "opacity-55 line-through",
                            )}
                          >
                            <span className="font-medium tabular-nums text-foreground">
                              {formatHm(row.appointment_time)}
                            </span>{" "}
                            <span className="text-foreground">{row.client_name}</span>
                            {row.service_name ? (
                              <span className="block truncate text-[9px] text-muted-foreground">
                                {row.service_name}
                              </span>
                            ) : null}
                          </li>
                        ))
                      )}
                      {more > 0 ? (
                        <li className="text-[10px] font-medium text-primary">+{more} więcej</li>
                      ) : null}
                    </ul>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </PageShell>

      <Sheet
        open={detailDate != null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDate(null)
            setConfirmCancelForId(null)
          }
        }}
      >
        <SheetContent className="premium-scrollbar flex w-full max-w-md flex-col" showCloseButton>
          <SheetHeader className="border-b border-border/70 text-left pb-3">
            <SheetTitle className="text-base">
              {detailDate
                ? formatters.dayLong.format(
                    new Date(
                      Number(detailDate.slice(0, 4)),
                      Number(detailDate.slice(5, 7)) - 1,
                      Number(detailDate.slice(8, 10)),
                    ),
                  )
                : "Szczegóły dnia"}
            </SheetTitle>
            {detailDate ? (
              <p className="text-xs text-muted-foreground">{visitCountLabel(detailRows.length)}</p>
            ) : null}
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {detailRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zaplanowanych wizyt</p>
            ) : (
              detailRows.map((row) => {
                const isCancelled = normalizeStatus(row.status) === "cancelled"
                const staffLabel =
                  row.staff_name?.trim() ||
                  (row.staff_id ? staffNameById.get(row.staff_id) : "") ||
                  "Nie przypisano osoby"
                const isConfirmingCancel = confirmCancelForId === row.id
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "rounded-lg border border-border/80 px-2.5 py-2",
                      isCancelled && "opacity-70",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-foreground">
                          <span className="tabular-nums">{formatHm(row.appointment_time)}</span>
                          <span className="text-muted-foreground"> · </span>
                          {row.client_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.service_name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{staffLabel}</p>
                      </div>
                      <StatusBadge status={normalizeStatus(row.status)} />
                    </div>

                    {!isCancelled ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {isConfirmingCancel ? (
                          <div className="w-full space-y-1.5 rounded-md border border-border/70 bg-muted/30 p-2">
                            <p className="text-xs text-muted-foreground">
                              {t("appointments.cancelVisitConfirmMessage")}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={cancellingId === row.id}
                                onClick={() => setConfirmCancelForId(null)}
                              >
                                {t("appointments.cancelVisitConfirmBack")}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={cancellingId === row.id}
                                onClick={() => cancelScheduleVisit(row)}
                              >
                                {cancellingId === row.id
                                  ? t("bookings.loading")
                                  : t("appointments.cancelVisitConfirmAction")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
                                  {t("appointments.changeStatusAction")}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-52">
                                {STATUS_MENU_ORDER.map((status) => (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={() => changeScheduleBookingStatus(row.id, status)}
                                  >
                                    {t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked")}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setConfirmCancelForId(row.id)}
                            >
                              {t("appointments.cancelVisit")}
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
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
