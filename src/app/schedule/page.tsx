"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AvailabilityExceptionRecord } from "@/lib/booking/effective-availability"
import { indexExceptionsByDate } from "@/lib/booking/effective-availability"
import { getPolishHolidayEntryForDateKey } from "@/lib/calendar/polish-holidays"
import type { PolishHolidayEntry } from "@/lib/calendar/polish-holidays"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getAvailabilityRules } from "@/lib/availability/availability-store"
import {
  getMonthSchedule,
  getWeekdayFromYmd,
  type StaffDaySchedule,
  type StaffExceptionForDay,
  type TeamScheduleDayCell,
} from "@/lib/schedule/team-schedule"
import { getStaffForBusiness } from "@/lib/staff/staff-store"
import type { StaffAvailabilityRuleInput } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { StaffMember } from "@/types/domain"
import type { Tables } from "@/types/database"

const PREVIEW_LINES = 3

type StatusFilter = "all" | "working" | "off" | "special"

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
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

function scheduleWeekdayTranslationKey(ymd: string): string {
  const keys = [
    "weekdaySunday",
    "weekdayMonday",
    "weekdayTuesday",
    "weekdayWednesday",
    "weekdayThursday",
    "weekdayFriday",
    "weekdaySaturday",
  ] as const
  return `schedule.${keys[getWeekdayFromYmd(ymd)]}`
}

function formatDisplayDate(
  ymd: string,
  lang: "pl" | "en",
  formatters: { long: Intl.DateTimeFormat; dayMo: Intl.DateTimeFormat },
): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  return formatters.long.format(dt)
}

function filterSchedules(
  cell: TeamScheduleDayCell,
  staffId: string | null,
  statusFilter: StatusFilter,
): StaffDaySchedule[] {
  let rows = cell.schedules
  if (staffId) {
    rows = rows.filter((r) => r.staffId === staffId)
  }
  if (statusFilter === "working") {
    return rows.filter((r) => r.status === "working")
  }
  if (statusFilter === "off") {
    return rows.filter((r) => r.status === "off")
  }
  if (statusFilter === "special") {
    return rows.filter((r) => r.status === "working" && r.isSpecialHours)
  }
  return rows
}

function sourceLabelKey(src: StaffDaySchedule["source"]): string {
  switch (src) {
    case "business_hours":
      return "schedule.sourceBusiness"
    case "staff_hours":
      return "schedule.sourceStaff"
    case "exception_available":
      return "schedule.sourceExceptionAvailable"
    case "exception_unavailable":
      return "schedule.sourceExceptionUnavailable"
    case "holiday":
      return "schedule.sourceHoliday"
    case "business_closed":
      return "schedule.sourceBusinessClosed"
    case "inactive":
      return "schedule.reasonInactive"
    default:
      return "schedule.sourceBusiness"
  }
}

export default function SchedulePage() {
  const { t, language } = useTranslations()
  const access = useBusinessAccess()
  const [ym, setYm] = React.useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() + 1 }
  })
  const [staffMembers, setStaffMembers] = React.useState<StaffMember[]>([])
  const [baseDays, setBaseDays] = React.useState<Awaited<ReturnType<typeof getAvailabilityRules>>>([])
  const [bizRows, setBizRows] = React.useState<Tables<"availability_exceptions">[]>([])
  const [staffRuleRows, setStaffRuleRows] = React.useState<
    Pick<
      Tables<"staff_availability_rules">,
      "staff_id" | "weekday" | "is_available" | "start_time" | "end_time"
    >[]
  >([])
  const [staffExcRows, setStaffExcRows] = React.useState<Tables<"staff_availability_exceptions">[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [linkedStaffId, setLinkedStaffId] = React.useState<string | null | undefined>(undefined)
  const [personFilter, setPersonFilter] = React.useState<string>("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [detailDate, setDetailDate] = React.useState<string | null>(null)

  const formatters = React.useMemo(() => {
    const loc = language === "en" ? "en-GB" : "pl-PL"
    return {
      long: new Intl.DateTimeFormat(loc, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      dayMo: new Intl.DateTimeFormat(loc, { day: "numeric", month: "long" }),
      monthYear: new Intl.DateTimeFormat(loc, { month: "long", year: "numeric" }),
    }
  }, [language])

  const weekdayHeader = React.useMemo(() => {
    const start = new Date(2024, 0, 8)
    const loc = language === "en" ? "en-GB" : "pl-PL"
    const short = new Intl.DateTimeFormat(loc, { weekday: "short" })
    const out: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      out.push(short.format(d))
    }
    return out
  }, [language])

  const reload = React.useCallback(async () => {
    setLoadError(false)
    setLoading(true)
    const client = getBrowserClient()
    const bid = client && isSupabaseConfigured() ? await getCurrentBusinessProfileIdForClient(client) : null
    if (!client || !bid) {
      setStaffMembers([])
      setBaseDays([])
      setBizRows([])
      setStaffRuleRows([])
      setStaffExcRows([])
      setLoading(false)
      return
    }
    try {
      const [members, days, bizEx, rules, exc] = await Promise.all([
        getStaffForBusiness(client, bid),
        getAvailabilityRules(client, bid),
        client.from("availability_exceptions").select("*").eq("business_id", bid),
        client
          .from("staff_availability_rules")
          .select("staff_id, weekday, is_available, start_time, end_time")
          .eq("business_id", bid),
        client.from("staff_availability_exceptions").select("*").eq("business_id", bid),
      ])
      setStaffMembers(members)
      setBaseDays(days)
      setBizRows((bizEx.data as Tables<"availability_exceptions">[]) ?? [])
      setStaffRuleRows((rules.data as Tables<"staff_availability_rules">[]) ?? [])
      setStaffExcRows((exc.data as Tables<"staff_availability_exceptions">[]) ?? [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    queueMicrotask(() => {
      void reload()
    })
  }, [reload])

  React.useEffect(() => {
    const client = getBrowserClient()
    if (!client || !isSupabaseConfigured() || !access.businessId || access.effectiveRole !== "staff") {
      queueMicrotask(() => setLinkedStaffId(null))
      return
    }
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await client.auth.getUser()
      if (!user || cancelled) return
      const { data } = await client
        .from("business_members")
        .select("staff_member_id")
        .eq("business_id", access.businessId!)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!cancelled) {
        setLinkedStaffId(data?.staff_member_id?.trim() || null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access.businessId, access.effectiveRole])

  const staffRulesByStaffId = React.useMemo(() => {
    const m = new Map<string, StaffAvailabilityRuleInput[]>()
    for (const row of staffRuleRows) {
      const sid = row.staff_id.trim()
      const arr = m.get(sid) ?? []
      arr.push({
        weekday: row.weekday,
        isAvailable: row.is_available,
        startTime: String(row.start_time).slice(0, 5),
        endTime: String(row.end_time).slice(0, 5),
      })
      m.set(sid, arr)
    }
    return m
  }, [staffRuleRows])

  const staffExceptionsByStaffAndDate = React.useMemo(() => {
    const exMap = new Map<string, StaffExceptionForDay>()
    for (const row of staffExcRows) {
      const dk = String(row.exception_date).slice(0, 10)
      const key = `${row.staff_id}|${dk}`
      exMap.set(key, {
        isUnavailable: row.is_unavailable,
        startTime: row.start_time ? String(row.start_time).slice(0, 5) : null,
        endTime: row.end_time ? String(row.end_time).slice(0, 5) : null,
        reason: row.reason,
      })
    }
    return exMap
  }, [staffExcRows])

  const businessExceptionsByDate = React.useMemo(() => {
    const mapped: AvailabilityExceptionRecord[] = bizRows.map((row) => ({
      id: row.id,
      business_id: row.business_id,
      exception_date: row.exception_date,
      is_closed: row.is_closed,
      start_time: row.start_time,
      end_time: row.end_time,
      reason: row.reason,
    }))
    return indexExceptionsByDate(mapped)
  }, [bizRows])

  const visibleStaff = React.useMemo(() => {
    if (access.effectiveRole !== "staff") return staffMembers
    if (linkedStaffId) {
      return staffMembers.filter((s) => s.id === linkedStaffId)
    }
    return []
  }, [staffMembers, access.effectiveRole, linkedStaffId])

  const polishHolidayByDate = React.useMemo(() => {
    const m = new Map<string, PolishHolidayEntry | null>()
    const dim = daysInMonth(ym.year, ym.month)
    for (let d = 1; d <= dim; d++) {
      const key = dateKey(ym.year, ym.month, d)
      m.set(key, getPolishHolidayEntryForDateKey(key))
    }
    return m
  }, [ym.year, ym.month])

  const monthCells = React.useMemo(
    () => getMonthSchedule({
      month: ym.month,
      year: ym.year,
      staffMembers: visibleStaff,
      businessBaseDays: baseDays,
      businessExceptionsByDate,
      staffRulesByStaffId,
      staffExceptionsByStaffAndDate,
      polishHolidayByDate,
    }),
    [
      ym.month,
      ym.year,
      visibleStaff,
      baseDays,
      businessExceptionsByDate,
      staffRulesByStaffId,
      staffExceptionsByStaffAndDate,
      polishHolidayByDate,
    ],
  )

  const cellByDate = React.useMemo(() => new Map(monthCells.map((c) => [c.date, c])), [monthCells])

  const todayKey = React.useMemo(() => {
    const n = new Date()
    return dateKey(n.getFullYear(), n.getMonth() + 1, n.getDate())
  }, [])

  const goPrev = () =>
    setYm((p) => {
      if (p.month <= 1) return { year: p.year - 1, month: 12 }
      return { year: p.year, month: p.month - 1 }
    })

  const goNext = () =>
    setYm((p) => {
      if (p.month >= 12) return { year: p.year + 1, month: 1 }
      return { year: p.year, month: p.month + 1 }
    })

  const goToday = () => {
    const n = new Date()
    setYm({ year: n.getFullYear(), month: n.getMonth() + 1 })
  }

  const detailCell = detailDate ? cellByDate.get(detailDate) : null
  /** W panelu szczegółów pełna lista wg wybranej osoby (filtre statusu tylko na siatce). */
  const detailSchedules = React.useMemo(() => {
    if (!detailCell) return []
    if (personFilter.trim()) {
      return detailCell.schedules.filter((s) => s.staffId === personFilter.trim())
    }
    return detailCell.schedules
  }, [detailCell, personFilter])

  const deniedStaffNoLink =
    access.ready &&
    isSupabaseConfigured() &&
    access.effectiveRole === "staff" &&
    linkedStaffId === null

  if (deniedStaffNoLink) {
    return (
      <AppShell title={t("schedule.title")} pageDescription={t("schedule.description")}>
        <PageShell>
          <p className="text-sm text-muted-foreground">{t("schedule.accessDeniedStaff")}</p>
        </PageShell>
      </AppShell>
    )
  }

  if (access.ready && access.effectiveRole === "staff" && linkedStaffId === undefined) {
    return (
      <AppShell title={t("schedule.title")} pageDescription={t("schedule.description")}>
        <PageShell>
          <p className="text-sm text-muted-foreground">{t("schedule.loading")}</p>
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell title={t("schedule.title")} pageDescription={t("schedule.description")}>
      <PageShell>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={goPrev} aria-label={t("schedule.prevMonth")}>
              <ChevronLeft className="size-4" />
            </Button>
            <p className="min-w-[10rem] text-center text-sm font-semibold capitalize sm:min-w-[12rem]">
              {formatters.monthYear.format(new Date(ym.year, ym.month - 1, 1))}
            </p>
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={goNext} aria-label={t("schedule.nextMonth")}>
              <ChevronRight className="size-4" />
            </Button>
            <Button type="button" variant="secondary" size="sm" className="rounded-xl" onClick={goToday}>
              {t("schedule.today")}
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <Label htmlFor="sch-person" className="text-xs text-muted-foreground">
                {t("schedule.filterPerson")}
              </Label>
              <select
                id="sch-person"
                className="h-9 min-w-[12rem] rounded-md border border-input bg-background px-2 text-sm"
                value={personFilter}
                onChange={(e) => setPersonFilter(e.target.value)}
                disabled={access.effectiveRole === "staff"}
              >
                <option value="">{t("schedule.filterPersonAll")}</option>
                {visibleStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="sch-status" className="text-xs text-muted-foreground">
                {t("schedule.filterStatus")}
              </Label>
              <select
                id="sch-status"
                className="h-9 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">{t("schedule.filterStatusAll")}</option>
                <option value="working">{t("schedule.filterStatusWorking")}</option>
                <option value="off">{t("schedule.filterStatusOff")}</option>
                <option value="special">{t("schedule.filterStatusSpecial")}</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("schedule.loading")}</p>
        ) : loadError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{t("schedule.loadError")}</p>
        ) : visibleStaff.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <>
            {/* Mobile: lista dni */}
            <div className="space-y-2 md:hidden">
              {monthCells.map((cell) => (
                <DayCard
                  key={cell.date}
                  cell={cell}
                  todayKey={todayKey}
                  personFilter={personFilter}
                  statusFilter={statusFilter}
                  onOpenDetail={() => setDetailDate(cell.date)}
                  t={t}
                  weekdayLabel={(ymd) => t(scheduleWeekdayTranslationKey(ymd) as never)}
                  formatDayTitle={(ymd) => formatDisplayDate(ymd, language === "en" ? "en" : "pl", formatters)}
                />
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block">
              <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
                {weekdayHeader.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {weekMondayFirstCells(ym.year, ym.month).map((dayNum, idx) => {
                  if (dayNum == null) {
                    return <div key={`e-${idx}`} className="min-h-[7rem] rounded-xl border border-transparent bg-muted/5" />
                  }
                  const key = dateKey(ym.year, ym.month, dayNum)
                  const cell = cellByDate.get(key)
                  if (!cell) return null
                  const isToday = key === todayKey
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setDetailDate(key)}
                      className={cn(
                        "flex min-h-[7rem] flex-col rounded-xl border bg-card p-1.5 text-left text-xs shadow-sm transition-colors hover:bg-muted/30",
                        isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border/80",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-0.5">
                        <span className="font-semibold text-foreground">{dayNum}</span>
                        {cell.holiday ? (
                          <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[0.6rem] font-medium text-amber-900 dark:text-amber-100">
                            {t("schedule.holidayBadge")}
                          </span>
                        ) : null}
                      </div>
                      <DayPreviewLines
                        cell={cell}
                        personFilter={personFilter}
        statusFilter={statusFilter}
        t={t}
        onMore={() => setDetailDate(key)}
      />
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </PageShell>

      <Sheet open={detailDate != null} onOpenChange={(o) => !o && setDetailDate(null)}>
        <SheetContent className="premium-scrollbar flex w-full max-w-md flex-col sm:max-w-lg" showCloseButton>
          <SheetHeader className="border-b border-border/70 text-left">
            <SheetTitle>
              {detailCell
                ? t("schedule.dayDetailTitle").replace(
                    "{date}",
                    formatDisplayDate(detailCell.date, language === "en" ? "en" : "pl", formatters),
                  )
                : ""}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-1 py-4">
            {detailCell ? (
              <>
                <section>
                  <h3 className="text-sm font-semibold">{t("schedule.sectionHoliday")}</h3>
                  {detailCell.holiday ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {language === "en" ? detailCell.holiday.nameEn : detailCell.holiday.namePl}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">{t("schedule.noHoliday")}</p>
                  )}
                </section>

                <section>
                  <h3 className="text-sm font-semibold">{t("schedule.sectionWorking")}</h3>
                  <ul className="mt-2 space-y-2">
                    {detailSchedules
                      .filter((r) => r.status === "working")
                      .map((r) => (
                        <li key={r.staffId} className="rounded-lg border border-primary/15 bg-primary/5 px-2 py-1.5 text-sm">
                          <span className="font-medium text-foreground">{r.fullName}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            — {r.startTime}–{r.endTime}
                          </span>
                          <p className="text-[0.7rem] text-muted-foreground">
                            {t(sourceLabelKey(r.source))}
                            {r.isSpecialHours ? ` · ${t("schedule.offSpecial")}` : ""}
                          </p>
                          {access.effectiveRole !== "staff" ? (
                            <Link href="/team" className="mt-1 inline-block text-[0.7rem] font-medium text-primary underline-offset-4 hover:underline">
                              {t("schedule.editStaffLink")}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                  {detailSchedules.filter((r) => r.status === "working").length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">—</p>
                  ) : null}
                </section>

                <section>
                  <h3 className="text-sm font-semibold">{t("schedule.sectionUnavailable")}</h3>
                  <ul className="mt-2 space-y-2">
                    {detailSchedules
                      .filter((r) => r.status !== "working")
                      .map((r) => (
                        <li
                          key={r.staffId}
                          className={cn(
                            "rounded-lg border px-2 py-1.5 text-sm",
                            r.status === "inactive"
                              ? "border-border bg-muted/40 text-muted-foreground"
                              : "border-destructive/15 bg-destructive/5",
                          )}
                        >
                          <span className="font-medium">{r.fullName}</span>
                          <p className="text-[0.75rem] text-muted-foreground">
                            {r.status === "inactive"
                              ? t("schedule.reasonInactive")
                              : r.source === "holiday"
                                ? t("schedule.reasonHoliday")
                                : r.source === "exception_unavailable"
                                  ? t("schedule.reasonException")
                                  : t("schedule.reasonOff")}
                          </p>
                          {r.note ? <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{r.note}</p> : null}
                        </li>
                      ))}
                  </ul>
                </section>

                <section>
                  <h3 className="text-sm font-semibold">{t("schedule.sectionExceptions")}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {detailSchedules
                      .map((r) => r.note?.trim())
                      .filter(Boolean)
                      .map((note, i) => (
                        <li key={`${note}-${i}`}>{note}</li>
                      ))}
                  </ul>
                  {detailSchedules.every((s) => !(s.note ?? "").trim()) ? (
                    <p className="mt-1 text-sm text-muted-foreground">—</p>
                  ) : null}
                </section>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  )
}

function DayPreviewLines({
  cell,
  personFilter,
  statusFilter,
  t,
  onMore,
}: {
  cell: TeamScheduleDayCell
  personFilter: string
  statusFilter: StatusFilter
  t: (k: string) => string
  onMore: () => void
}) {
  const rows = filterSchedules(cell, personFilter || null, statusFilter)
  const workingPreferred = [
    ...rows.filter((r) => r.status === "working"),
    ...rows.filter((r) => r.status !== "working"),
  ]
  const shown = workingPreferred.slice(0, PREVIEW_LINES)
  const more = Math.max(0, workingPreferred.length - PREVIEW_LINES)

  return (
    <ul className="mt-1 flex-1 space-y-0.5 overflow-hidden text-[0.68rem] leading-tight">
      {shown.map((r) => (
        <li key={r.staffId} className="truncate text-muted-foreground">
          {r.status === "working" ? (
            <>
              <span className="text-foreground">{r.fullName}</span> — {r.startTime}–{r.endTime}
              {r.isSpecialHours ? ` · ${t("schedule.offSpecial")}` : ""}
            </>
          ) : r.status === "inactive" ? (
            <>
              <span className="text-muted-foreground/80">{r.fullName}</span> — {t("schedule.inactive")}
            </>
          ) : (
            <>
              <span className="text-foreground">{r.fullName}</span> — {t("schedule.offFree")}
            </>
          )}
        </li>
      ))}
      {more > 0 ? (
        <li>
          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={onMore}>
            {t("schedule.moreCount").replace("{count}", String(more))}
          </button>
        </li>
      ) : null}
    </ul>
  )
}

function DayCard({
  cell,
  todayKey,
  personFilter,
  statusFilter,
  onOpenDetail,
  t,
  weekdayLabel,
  formatDayTitle,
}: {
  cell: TeamScheduleDayCell
  todayKey: string
  personFilter: string
  statusFilter: StatusFilter
  onOpenDetail: () => void
  t: (k: string) => string
  weekdayLabel: (ymd: string) => string
  formatDayTitle: (ymd: string) => string
}) {
  const isToday = cell.date === todayKey
  return (
    <Card className={cn("rounded-xl border shadow-sm", isToday ? "border-primary/35" : "border-border/80")}>
      <CardContent className="p-3">
        <button type="button" className="flex w-full text-left" onClick={onOpenDetail}>
          <div className="flex w-full items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold leading-none">{cell.date.slice(8, 10)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{weekdayLabel(cell.date)}</p>
              <p className="text-[0.65rem] text-muted-foreground">{formatDayTitle(cell.date)}</p>
            </div>
            {cell.holiday ? (
              <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[0.65rem] font-medium text-amber-900 dark:text-amber-100">
                {t("schedule.holidayBadge")}
              </span>
            ) : null}
          </div>
        </button>
        <div className="mt-2">
          <DayPreviewLines
            cell={cell}
            personFilter={personFilter}
            statusFilter={statusFilter}
            t={t}
            onMore={onOpenDetail}
          />
        </div>
      </CardContent>
    </Card>
  )
}
