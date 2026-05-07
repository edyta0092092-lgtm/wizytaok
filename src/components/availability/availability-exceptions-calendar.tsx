"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { parseLocalDateKey } from "@/components/booking/public-booking-calendar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteAvailabilityException,
  deleteAvailabilityExceptionByDate,
  getAvailabilityExceptionsForBusiness,
  saveAvailabilityException,
} from "@/lib/availability/availability-store"
import type { AvailabilityExceptionRecord } from "@/lib/booking/effective-availability"
import {
  getPolishHolidayDisplayName,
  isPolishCalendarHoliday,
  isPolishPublicHoliday,
} from "@/lib/calendar/polish-holidays"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Language } from "@/lib/i18n/dictionaries"
import { cn } from "@/lib/utils"
import type { AvailabilityDay } from "@/types/domain"

type Translate = (key: string) => string

type Props = {
  businessProfileId: string | null
  weeklyDays: AvailabilityDay[]
  language: Language
  t: Translate
}

type DayMode = "regular" | "closed" | "special"

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function toLocalDateKeyFromParts(year: number, monthIndex: number, day: number): string {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function firstWeekdayMondayBased(year: number, monthIndex: number): number {
  const d = new Date(year, monthIndex, 1)
  return (d.getDay() + 6) % 7
}

function shiftMonth(year: number, monthIndex: number, delta: number): [number, number] {
  const d = new Date(year, monthIndex + delta, 1)
  return [d.getFullYear(), d.getMonth()]
}

function toMinutes(hm: string): number {
  const parts = hm.split(":").map((x) => Number(String(x).trim()))
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  return h * 60 + m
}

function exceptionForKey(
  rows: AvailabilityExceptionRecord[],
  key: string,
): AvailabilityExceptionRecord | undefined {
  return rows.find((r) => String(r.exception_date).slice(0, 10) === key)
}

function formatDateKeyForUi(dateKey: string, lang: Language): string {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey
  const dt = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt)
}

export function AvailabilityExceptionsCalendar({ businessProfileId, weeklyDays, language, t }: Props) {
  const initialMonth = React.useMemo(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  }, [])
  const [viewYear, setViewYear] = React.useState(initialMonth.year)
  const [viewMonth, setViewMonth] = React.useState(initialMonth.month)
  const [todayKey] = React.useState(() => {
    const n = new Date()
    return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`
  })
  const [rows, setRows] = React.useState<AvailabilityExceptionRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)
  const [notice, setNotice] = React.useState<"saved" | "deleted" | "error" | null>(null)

  const [activeKey, setActiveKey] = React.useState<string | null>(null)
  const [mode, setMode] = React.useState<DayMode>("regular")
  const [formStart, setFormStart] = React.useState("09:00")
  const [formEnd, setFormEnd] = React.useState("17:00")
  const [formReason, setFormReason] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const refresh = React.useCallback(async () => {
    if (!isSupabaseConfigured() || !businessProfileId) {
      setRows([])
      setLoadError(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    try {
      const client = getBrowserClient()
      const list = await getAvailabilityExceptionsForBusiness(client, businessProfileId)
      setRows(list)
    } catch {
      setLoadError(true)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [businessProfileId])

  React.useEffect(() => {
    queueMicrotask(() => {
      void refresh()
    })
  }, [refresh])

  React.useEffect(() => {
    if (!notice) return
    const tid = window.setTimeout(() => setNotice(null), 3200)
    return () => window.clearTimeout(tid)
  }, [notice])

  const selectDay = (dateKey: string) => {
    const d = parseLocalDateKey(dateKey)
    const ex = exceptionForKey(rows, dateKey)
    const hol = isPolishPublicHoliday(d)
    setActiveKey(dateKey)
    if (ex) {
      if (ex.is_closed) {
        setMode("closed")
      } else {
        setMode("special")
        setFormStart(ex.start_time ? String(ex.start_time).slice(0, 5) : "09:00")
        setFormEnd(ex.end_time ? String(ex.end_time).slice(0, 5) : "17:00")
      }
      setFormReason(ex.reason ?? "")
    } else {
      setMode(hol ? "closed" : "regular")
      const wd = d.getDay()
      const tpl = weeklyDays.find((x) => x.weekday === wd)
      setFormStart(tpl?.startTime ?? "09:00")
      setFormEnd(tpl?.endTime ?? "17:00")
      setFormReason("")
    }
  }

  const submitSave = () => {
    void (async () => {
      if (!businessProfileId || !activeKey) return
      const client = getBrowserClient()
      if (!client) return
      const d = parseLocalDateKey(activeKey)

      if (mode === "special") {
        if (toMinutes(formEnd) <= toMinutes(formStart)) {
          setNotice("error")
          return
        }
      }

      setSaving(true)
      try {
        if (mode === "regular") {
          const existing = exceptionForKey(rows, activeKey)
          if (existing) {
            const del = await deleteAvailabilityExceptionByDate(client, businessProfileId, activeKey)
            if (!del.ok) {
              setNotice("error")
              return
            }
          } else if (isPolishPublicHoliday(d)) {
            const wd = d.getDay()
            const tpl = weeklyDays.find((x) => x.weekday === wd)
            if (tpl?.isOpen) {
              const res = await saveAvailabilityException(client, businessProfileId, {
                exceptionDate: activeKey,
                isClosed: false,
                startTime: tpl.startTime,
                endTime: tpl.endTime,
                reason: formReason.trim() ? formReason.trim() : null,
              })
              if (!res.ok) {
                setNotice("error")
                return
              }
            } else {
              const res = await saveAvailabilityException(client, businessProfileId, {
                exceptionDate: activeKey,
                isClosed: true,
                reason: formReason.trim() ? formReason.trim() : null,
              })
              if (!res.ok) {
                setNotice("error")
                return
              }
            }
          }
          setNotice("saved")
          await refresh()
          return
        }

        if (mode === "closed") {
          const res = await saveAvailabilityException(client, businessProfileId, {
            exceptionDate: activeKey,
            isClosed: true,
            reason: formReason.trim() ? formReason.trim() : null,
          })
          if (!res.ok) {
            setNotice("error")
            return
          }
          setNotice("saved")
          await refresh()
          return
        }

        const res = await saveAvailabilityException(client, businessProfileId, {
          exceptionDate: activeKey,
          isClosed: false,
          startTime: formStart,
          endTime: formEnd,
          reason: formReason.trim() ? formReason.trim() : null,
        })
        if (!res.ok) {
          setNotice("error")
          return
        }
        setNotice("saved")
        await refresh()
      } finally {
        setSaving(false)
      }
    })()
  }

  const submitDelete = () => {
    void (async () => {
      if (!businessProfileId || !activeKey) return
      const client = getBrowserClient()
      if (!client) return
      setSaving(true)
      try {
        const res = await deleteAvailabilityExceptionByDate(client, businessProfileId, activeKey)
        if (!res.ok) {
          setNotice("error")
          return
        }
        setNotice("deleted")
        setActiveKey(null)
        await refresh()
      } finally {
        setSaving(false)
      }
    })()
  }

  const deleteExceptionById = (id: string, dateKey: string) => {
    void (async () => {
      if (!window.confirm(t("availability.deleteExceptionConfirm"))) return
      const client = getBrowserClient()
      if (!client || !businessProfileId) return
      setSaving(true)
      try {
        const res = await deleteAvailabilityException(client, businessProfileId, id)
        if (!res.ok) {
          setNotice("error")
          return
        }
        setNotice("deleted")
        if (activeKey === dateKey) setActiveKey(null)
        await refresh()
      } finally {
        setSaving(false)
      }
    })()
  }

  const monthTitle = React.useMemo(() => {
    const d = new Date(viewYear, viewMonth, 1)
    return new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
      month: "long",
      year: "numeric",
    }).format(d)
  }, [viewMonth, viewYear, language])

  const calendarCells = React.useMemo(() => {
    const dim = daysInMonth(viewYear, viewMonth)
    const lead = firstWeekdayMondayBased(viewYear, viewMonth)
    const [prevYear, prevMonth] = shiftMonth(viewYear, viewMonth, -1)
    const [nextYear, nextMonth] = shiftMonth(viewYear, viewMonth, 1)
    const dimPrev = daysInMonth(prevYear, prevMonth)

    const cells: { year: number; month: number; day: number; inMonth: boolean }[] = []

    for (let i = lead - 1; i >= 0; i -= 1) {
      cells.push({
        year: prevYear,
        month: prevMonth,
        day: dimPrev - i,
        inMonth: false,
      })
    }
    for (let day = 1; day <= dim; day += 1) {
      cells.push({ year: viewYear, month: viewMonth, day, inMonth: true })
    }

    const rows = Math.ceil(cells.length / 7)
    const target = Math.max(35, rows * 7)
    let trailingDay = 1
    while (cells.length < target) {
      cells.push({
        year: nextYear,
        month: nextMonth,
        day: trailingDay,
        inMonth: false,
      })
      trailingDay += 1
    }
    return cells
  }, [viewMonth, viewYear])

  const weekdayLabels = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

  const sortedExceptions = React.useMemo(() => {
    return [...rows].sort((a, b) => String(a.exception_date).localeCompare(String(b.exception_date)))
  }, [rows])

  if (!isSupabaseConfigured() || !businessProfileId) {
    return null
  }

  const activeDate = activeKey ? parseLocalDateKey(activeKey) : null
  const holidayDisplay = activeDate ? getPolishHolidayDisplayName(activeDate, language) : null

  return (
    <Card className="mt-5 rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-border/70 py-3 sm:py-4">
        <CardTitle className="text-base font-semibold">{t("availability.exceptionsTitle")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("availability.exceptionsHint")}</p>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 overflow-x-hidden pt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("availability.loadingExceptions")}
          </p>
        ) : null}
        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {t("availability.loadExceptionsError")}
          </p>
        ) : null}
        {notice === "saved" ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {t("availability.dayOffSavedBanner")}
          </p>
        ) : null}
        {notice === "deleted" ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
            {t("availability.exceptionDeleted")}
          </p>
        ) : null}
        {notice === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {t("availability.saveExceptionError")}
          </p>
        ) : null}

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:items-start">
          <div className="mx-auto w-full max-w-[620px] min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 rounded-lg"
                aria-label={t("availability.prevMonth")}
                onClick={() => {
                  const [ny, nm] = shiftMonth(viewYear, viewMonth, -1)
                  setViewYear(ny)
                  setViewMonth(nm)
                }}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold capitalize leading-tight text-foreground">
                {monthTitle}
              </p>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 rounded-lg"
                aria-label={t("availability.nextMonth")}
                onClick={() => {
                  const [ny, nm] = shiftMonth(viewYear, viewMonth, 1)
                  setViewYear(ny)
                  setViewMonth(nm)
                }}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>

            <div className="w-full overflow-hidden rounded-xl border border-border/80 bg-muted/10 p-2 sm:p-2.5">
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {weekdayLabels.map((k) => (
                  <div key={k} className="truncate py-1">
                    {t(`availability.${k}`).slice(0, 2)}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  const dateKey = toLocalDateKeyFromParts(cell.year, cell.month, cell.day)
                  const cellDate = parseLocalDateKey(dateKey)
                  const ex = exceptionForKey(rows, dateKey)
                  const isHoliday = isPolishCalendarHoliday(cellDate)
                  const isPublicHoliday = isPolishPublicHoliday(cellDate)
                  const weekday = cellDate.getDay()
                  const weeklyDay = weeklyDays.find((x) => x.weekday === weekday)
                  const closedByWeeklyRule = !weeklyDay?.isOpen
                  const isToday = dateKey === todayKey
                  const isSelected = dateKey === activeKey
                  const holidayName = getPolishHolidayDisplayName(cellDate, language)

                  let tone: "normal" | "holiday" | "closed" | "special" = "normal"
                  let statusText: string | null = null
                  let scheduleText: string | null = null
                  if (ex) {
                    if (ex.is_closed) {
                      tone = "closed"
                      statusText = t("availability.legendClosed")
                    } else {
                      tone = "special"
                      statusText = t("availability.legendSpecial")
                      scheduleText =
                        ex.start_time && ex.end_time
                          ? `${String(ex.start_time).slice(0, 5)}-${String(ex.end_time).slice(0, 5)}`
                          : null
                    }
                  } else if (isPublicHoliday) {
                    tone = "closed"
                    statusText = t("availability.legendClosed")
                  } else if (closedByWeeklyRule) {
                    tone = "closed"
                    statusText = t("availability.legendClosed")
                  } else if (isHoliday) {
                    tone = "holiday"
                  }

                  const titleParts = [
                    `${cell.day}`,
                    holidayName ? t("availability.holidayTitle").replace("{name}", holidayName) : "",
                    scheduleText,
                    statusText,
                    ex?.reason?.trim() ?? "",
                  ].filter(Boolean)

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => selectDay(dateKey)}
                      title={titleParts.join(" · ")}
                      className={cn(
                        "flex h-[4.8rem] min-h-[4.5rem] w-full flex-col items-start justify-start gap-1 overflow-hidden rounded-lg border px-1.5 py-1.5 text-left text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-[5.4rem] sm:min-h-[5.1rem] sm:px-2",
                        !cell.inMonth && "opacity-45",
                        tone === "normal" &&
                          "border-transparent bg-background hover:bg-muted/70 dark:bg-card dark:hover:bg-muted/35",
                        tone === "holiday" &&
                          "border-rose-400/25 bg-rose-500/[0.07] text-foreground hover:bg-rose-500/12 dark:border-rose-400/20 dark:bg-rose-500/10 dark:hover:bg-rose-500/15",
                        tone === "closed" &&
                          "border-border/80 bg-muted text-muted-foreground hover:bg-muted/85 dark:bg-muted/35 dark:text-muted-foreground",
                        tone === "special" &&
                          "border-amber-500/35 bg-amber-500/12 text-amber-950 hover:bg-amber-500/18 dark:border-amber-400/30 dark:bg-amber-500/12 dark:text-amber-100 dark:hover:bg-amber-500/18",
                        isToday && "ring-1 ring-primary/50 ring-offset-1 ring-offset-background",
                        isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                      )}
                    >
                      <span className={cn("text-[12px] font-semibold", !cell.inMonth && "text-muted-foreground")}>
                        {cell.day}
                      </span>
                      {cell.inMonth && holidayName ? (
                        <span className="line-clamp-2 text-[10px] font-medium leading-tight text-rose-700 dark:text-rose-200">
                          {holidayName}
                        </span>
                      ) : null}
                      {cell.inMonth && scheduleText ? (
                        <span className="line-clamp-1 text-[10px] font-medium leading-tight">{scheduleText}</span>
                      ) : null}
                      {cell.inMonth && statusText ? (
                        <span className="line-clamp-1 text-[10px] leading-tight">{statusText}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] leading-tight text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded border border-primary/50 ring-1 ring-primary/40" />{" "}
                {t("availability.legendToday")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full bg-rose-500/80 dark:bg-rose-400" />{" "}
                {t("availability.legendHoliday")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full border border-border bg-muted dark:bg-muted/35" />{" "}
                {t("availability.legendClosed")}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2.5 rounded-full bg-amber-600 dark:bg-amber-400" />{" "}
                {t("availability.legendSpecial")}
              </span>
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            {!activeKey ? (
              <p className="rounded-lg border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
                {t("availability.selectDayHint")}
              </p>
            ) : (
              <div className="min-w-0 space-y-3 rounded-xl border border-border/80 bg-muted/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{t("availability.daySettingsTitle")}</p>
                    <p className="text-sm font-semibold text-foreground">{activeKey}</p>
                    {holidayDisplay ? (
                      <p className="text-sm font-medium text-rose-700 dark:text-rose-200">
                        {t("availability.holidayTitle").replace("{name}", holidayDisplay)}
                      </p>
                    ) : null}
                    {activeDate && isPolishPublicHoliday(activeDate) && !exceptionForKey(rows, activeKey) ? (
                      <p className="text-xs text-muted-foreground">{t("availability.holidayStatutoryTag")}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 rounded-lg text-xs text-muted-foreground"
                    onClick={() => setActiveKey(null)}
                  >
                    {t("availability.cancelDay")}
                  </Button>
                </div>

                {activeDate && isPolishPublicHoliday(activeDate) && !exceptionForKey(rows, activeKey) ? (
                  <p className="rounded-md border border-rose-400/20 bg-rose-500/[0.06] px-2.5 py-2 text-xs text-rose-900 dark:border-rose-400/15 dark:bg-rose-500/10 dark:text-rose-100">
                    {t("availability.holidayStatutoryHint")}
                  </p>
                ) : null}
                {activeDate &&
                !exceptionForKey(rows, activeKey) &&
                !isPolishPublicHoliday(activeDate) &&
                !weeklyDays.find((x) => x.weekday === activeDate.getDay())?.isOpen ? (
                  <p className="rounded-md border border-border/70 bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground">
                    {t("availability.closedDayHint")}
                  </p>
                ) : null}
                {activeDate &&
                isPolishPublicHoliday(activeDate) &&
                exceptionForKey(rows, activeKey)?.is_closed === false ? (
                  <p className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-950 dark:text-amber-100">
                    {t("availability.holidayOverrideSpecialHint")}
                  </p>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("availability.exceptionDate")}</p>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border/70 bg-background/80 p-0.5">
                    {(["regular", "closed", "special"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={cn(
                          "h-9 rounded-md text-center text-[11px] font-medium leading-tight transition-colors",
                          mode === m
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        {m === "regular"
                          ? t("availability.dayTypeRegular")
                          : m === "closed"
                            ? t("availability.dayTypeClosed")
                            : t("availability.dayTypeSpecial")}
                      </button>
                    ))}
                  </div>
                </div>

                {mode === "special" ? (
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor="ex-cal-start" className="text-xs">
                        {t("availability.from")}
                      </Label>
                      <Input
                        id="ex-cal-start"
                        type="time"
                        value={formStart}
                        onChange={(e) => setFormStart(e.target.value)}
                        className="h-10 max-w-full rounded-lg text-sm"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label htmlFor="ex-cal-end" className="text-xs">
                        {t("availability.to")}
                      </Label>
                      <Input
                        id="ex-cal-end"
                        type="time"
                        value={formEnd}
                        onChange={(e) => setFormEnd(e.target.value)}
                        className="h-10 max-w-full rounded-lg text-sm"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="min-w-0 space-y-1">
                  <Label htmlFor="ex-cal-reason" className="text-xs">
                    {t("availability.noteOptional")}
                  </Label>
                  <Textarea
                    id="ex-cal-reason"
                    rows={2}
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="min-h-0 resize-none rounded-lg text-sm"
                  />
                </div>

                <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    className="h-11 flex-1 rounded-xl sm:min-w-[8rem]"
                    disabled={saving}
                    onClick={() => void submitSave()}
                  >
                    {t("availability.saveDay")}
                  </Button>
                  {activeKey && exceptionForKey(rows, activeKey) ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className="h-11 flex-1 rounded-xl sm:min-w-[8rem]"
                      disabled={saving}
                      onClick={() => void submitDelete()}
                    >
                      {t("availability.deleteExceptionFull")}
                    </Button>
                  ) : null}
                </div>
              </div>
            )}

            <div className="min-w-0 space-y-2">
              <p className="text-sm font-semibold text-foreground">{t("availability.exceptionsListTitle")}</p>
              {sortedExceptions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-3 text-sm text-muted-foreground">
                  {t("availability.noExceptions")}
                </p>
              ) : (
                <ul className="max-h-[min(22rem,48vh)] space-y-2 overflow-y-auto overflow-x-hidden pr-0.5">
                  {sortedExceptions.map((r) => {
                    const key = String(r.exception_date).slice(0, 10)
                    const d = parseLocalDateKey(key)
                    const holName = getPolishHolidayDisplayName(d, language)
                    const typeLabel = r.is_closed
                      ? t("availability.exceptionClosedAllDay")
                      : t("availability.exceptionCustomHours")
                    const timePart =
                      !r.is_closed && r.start_time && r.end_time
                        ? `${String(r.start_time).slice(0, 5)}-${String(r.end_time).slice(0, 5)}`
                        : ""
                    const dateStr = formatDateKeyForUi(key, language)
                    const tail = r.is_closed ? typeLabel : `${typeLabel}${timePart ? ` (${timePart})` : ""}`
                    const mainLine = holName ? `${dateStr} - ${holName} - ${tail}` : `${dateStr} - ${tail}`
                    return (
                      <li
                        key={r.id}
                        className="rounded-lg border border-border/70 bg-background/90 px-3 py-2.5 text-sm shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="break-words font-medium text-foreground">{mainLine}</p>
                            {r.reason?.trim() ? (
                              <p className="break-words text-xs text-muted-foreground">{r.reason.trim()}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 w-full rounded-xl text-xs sm:w-auto"
                              onClick={() => selectDay(key)}
                            >
                              {t("availability.editExceptionFull")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 w-full rounded-xl text-xs text-destructive hover:text-destructive sm:w-auto"
                              disabled={saving}
                              onClick={() => deleteExceptionById(r.id, key)}
                            >
                              {t("availability.deleteExceptionFull")}
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
