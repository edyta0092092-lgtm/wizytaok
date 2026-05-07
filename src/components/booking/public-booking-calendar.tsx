"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Language } from "@/lib/i18n/dictionaries"
import {
  toLocalDateKey,
  isDayOpenForAvailability,
  getSlotsForSelectedDate,
  findFirstOpenBookingDateKey,
  filterSlotsNotInPast,
} from "@/lib/booking/availability-slots"
import { blockedSlotKey } from "@/lib/bookings/slot-availability"
import type { AvailabilityDay } from "@/types/domain"

export { toLocalDateKey } from "@/lib/booking/availability-slots"

const FULL_SLOTS = ["09:00", "10:00", "11:30", "13:00", "14:30", "16:00"]
const FRIDAY_SLOTS = ["09:00", "10:00", "11:30", "13:00"]

export function parseLocalDateKey(key: string): Date {
  const [y, mo, da] = key.split("-").map(Number)
  return new Date(y, mo - 1, da)
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstWeekdayMondayBased(year: number, month: number): number {
  const d = new Date(year, month, 1)
  return (d.getDay() + 6) % 7
}

function isSelectableDayLegacy(d: Date, today: Date): boolean {
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return false
  const dayStart = startOfLocalDay(d)
  if (dayStart < startOfLocalDay(today)) return false
  return true
}

function findFirstSelectableDateKeyLegacy(today: Date): string {
  for (let i = 0; i < 400; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
    if (isSelectableDayLegacy(d, today)) return toLocalDateKey(d)
  }
  return toLocalDateKey(today)
}

/**
 * Pierwszy wybieralny dzień. Legacy: pn–pt (bez usług/dostępności).
 * Z `opts`: realne sloty wg availability i długości usługi.
 */
export function findFirstSelectableDateKey(
  today: Date,
  opts?: {
    availability: AvailabilityDay[]
    serviceDurationMinutes: number
    asOfTime: Date
    /** Gdy true, używaj wyłącznie tablicy availability (nawet pustej), bez slotów legacy. */
    availabilityStrict?: boolean
    /** Zajęte sloty `YYYY-MM-DD|HH:MM` (np. z Supabase). */
    blockedSlotKeys?: ReadonlySet<string> | null
    /** Nadpisanie tygodniowych reguł dla konkretnej daty (wyjątki, godziny usługi). */
    resolveAvailabilityDaysForDate?: (d: Date) => AvailabilityDay[]
  }
): string | null {
  if (opts && (opts.availability.length > 0 || opts.availabilityStrict)) {
    const first = findFirstOpenBookingDateKey(
      today,
      opts.availability,
      Math.max(1, opts.serviceDurationMinutes),
      opts.asOfTime,
      opts.blockedSlotKeys ?? null,
      opts.resolveAvailabilityDaysForDate
    )
    return first
  }
  return findFirstSelectableDateKeyLegacy(today)
}

const emptySubscribe = () => () => {}

/**
 * Jedna stabilna data "dziś" po stronie klienta, bez setState w useEffect (hydration-safe).
 */
export function useClientToday(): Date | null {
  const cache = React.useRef<Date | null>(null)
  return React.useSyncExternalStore(
    emptySubscribe,
    () => {
      if (cache.current === null) {
        cache.current = new Date()
      }
      return cache.current
    },
    () => null
  )
}

function slotsForLocalDate(d: Date): string[] {
  return d.getDay() === 5 ? FRIDAY_SLOTS : FULL_SLOTS
}

function legacySlotsForDate(
  d: Date,
  clientToday: Date,
  asOf: Date,
  blockedSlotKeys?: ReadonlySet<string> | null
): string[] {
  const key = toLocalDateKey(d)
  let out = slotsForLocalDate(d)
  if (key === toLocalDateKey(clientToday)) {
    out = filterSlotsNotInPast(out, key, asOf)
  }
  if (blockedSlotKeys && blockedSlotKeys.size > 0) {
    out = out.filter((s) => !blockedSlotKeys.has(blockedSlotKey(key, s)))
  }
  return out
}

type PublicBookingCalendarProps = {
  language: Language
  t: (key: string) => string
  /** Ustawiane po stronie klienta, bez użycia w pierwszym renderze SSR. */
  clientToday: Date | null
  selectedDateKey: string | null
  onSelectDate: (key: string) => void
  selectedTime: string | null
  onSelectTime: (time: string | null) => void
  /** Dni/godziny otwarcia; jeśli podane z `serviceDurationMinutes`, używane do slotów. */
  availability?: AvailabilityDay[]
  /** Wymuś tryb slotów z availability (np. firma w Supabase), także gdy tablica jest pusta. */
  availabilityStrict?: boolean
  serviceDurationMinutes?: number
  /** Dla odfiltrowania przeszłych slotów w „dziś”; np. bieżąca chwila przy otwarciu sekcji. */
  asOfTime?: Date
  /** Tytuł sekcji (i18n pełna ścieżka, np. "bookingPublic.chooseTime"). */
  titleKey?: string
  /** Kalendarz ciaśniejszy (np. /confirm) */
  compact?: boolean
  /** Dedykowane etykiety w trybie z availability (np. confirm) */
  slotsSubheadingKey?: string
  emptySlotsKey?: string
  slotHelpKey?: string
  /** Ukryj tytuł karty (gdy nagłówek jest nad kalendarzem, np. /confirm). */
  hideTitle?: boolean
  /** Zajęte sloty `YYYY-MM-DD|HH:MM` (rezerwacje Supabase). */
  blockedSlotKeys?: ReadonlySet<string> | null
  /** Nadpisanie reguł dla pojedynczej daty (wyjątki kalendarza, godziny usługi). */
  resolveAvailabilityDaysForDate?: (d: Date) => AvailabilityDay[]
  /** Gdy brak slotów: rozróżnienie komunikatu (dzień zamknięty vs usługa). */
  slotEmptyDetail?: "closed" | "service" | null
  /**
   * Opcjonalne sloty dla dnia zamiast `getSlotsForSelectedDate`.
   * `null` lub `undefined` = użyj domyślnej ścieżki.
   */
  customSlotsForDate?: (d: Date) => string[] | null | undefined
}

export function PublicBookingCalendar({
  language,
  t,
  clientToday,
  selectedDateKey,
  onSelectDate,
  selectedTime,
  onSelectTime,
  availability = [],
  availabilityStrict = false,
  serviceDurationMinutes: serviceDurationInput,
  asOfTime,
  titleKey = "bookingPublic.chooseTime",
  compact = false,
  slotsSubheadingKey = "bookingPublic.availableTimes",
  emptySlotsKey = "bookingPublic.noSlotsToday",
  slotHelpKey = "bookingPublic.slotHelp",
  hideTitle = false,
  blockedSlotKeys = null,
  resolveAvailabilityDaysForDate,
  slotEmptyDetail = null,
  customSlotsForDate,
}: PublicBookingCalendarProps) {
  const useAvail =
    (availabilityStrict ||
      (Array.isArray(availability) && availability.length > 0)) &&
    serviceDurationInput != null &&
    serviceDurationInput > 0
  const serviceDuration = useAvail ? Math.max(1, serviceDurationInput ?? 30) : 30
  const asOf = React.useMemo(
    () =>
      asOfTime != null
        ? asOfTime
        : clientToday != null
          ? clientToday
          : new Date(0),
    [asOfTime, clientToday]
  )
  const baseView = clientToday
    ? { y: clientToday.getFullYear(), m: clientToday.getMonth() }
    : null
  const [viewYM, setViewYM] = React.useState<{ y: number; m: number } | null>(null)
  const activeView = viewYM ?? baseView

  const monthTitleFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        month: "long",
        year: "numeric",
      }),
    [language]
  )

  const selectedDayFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [language]
  )

  const dowLabels = React.useMemo(
    () => [
      t("bookingPublic.dowMon"),
      t("bookingPublic.dowTue"),
      t("bookingPublic.dowWed"),
      t("bookingPublic.dowThu"),
      t("bookingPublic.dowFri"),
      t("bookingPublic.dowSat"),
      t("bookingPublic.dowSun"),
    ],
    [t]
  )

  const shiftMonth = (delta: number) => {
    if (!activeView) return
    const d = new Date(activeView.y, activeView.m + delta, 1)
    setViewYM({ y: d.getFullYear(), m: d.getMonth() })
  }

  const selectedDate = selectedDateKey ? parseLocalDateKey(selectedDateKey) : null

  const slots = React.useMemo(() => {
    if (!selectedDate || !clientToday) return []
    if (useAvail && typeof customSlotsForDate === "function") {
      const custom = customSlotsForDate(selectedDate)
      if (custom != null) {
        const key = toLocalDateKey(selectedDate)
        let out = custom.slice()
        if (key === toLocalDateKey(clientToday)) {
          out = filterSlotsNotInPast(out, key, asOf)
        }
        if (blockedSlotKeys && blockedSlotKeys.size > 0) {
          out = out.filter((s) => !blockedSlotKeys.has(blockedSlotKey(key, s)))
        }
        return out
      }
    }
    if (useAvail) {
      const dayModel = resolveAvailabilityDaysForDate
        ? resolveAvailabilityDaysForDate(selectedDate)
        : availability
      return getSlotsForSelectedDate(
        selectedDate,
        clientToday,
        asOf,
        serviceDuration,
        dayModel,
        blockedSlotKeys
      )
    }
    return legacySlotsForDate(selectedDate, clientToday, asOf, blockedSlotKeys)
  }, [
    selectedDate,
    clientToday,
    useAvail,
    asOf,
    serviceDuration,
    availability,
    blockedSlotKeys,
    resolveAvailabilityDaysForDate,
    customSlotsForDate,
  ])

  const cardPad = compact ? "py-3" : "py-4"
  const gridMax = compact ? "max-w-[min(22rem,100%)]" : "max-w-[min(480px,100%)]"
  const cellSize = compact ? "size-9" : "size-10"
  const cellSizeSm = compact ? "sm:size-10" : "sm:size-11"

  if (!clientToday || !activeView) {
    return (
      <Card
        className={cn(
          "gap-3 rounded-2xl border border-border bg-card py-3 shadow-sm shadow-slate-900/5 sm:gap-3",
          cardPad
        )}
      >
        {hideTitle ? null : (
          <CardHeader className="space-y-0 px-4 pb-2 pt-0 sm:px-5 sm:pb-2.5">
            <CardTitle className="text-sm sm:text-base">{t(titleKey)}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="px-4 pb-3 pt-0 sm:px-5 sm:pb-4">
          <div
            className={cn(
              "mx-auto max-h-36 max-w-full animate-pulse rounded-xl bg-muted/40",
              gridMax
            )}
            aria-hidden
          />
        </CardContent>
      </Card>
    )
  }

  const dim = daysInMonth(activeView.y, activeView.m)
  const lead = firstWeekdayMondayBased(activeView.y, activeView.m)
  const cells: (number | null)[] = [...Array(lead).fill(null)]
  for (let day = 1; day <= dim; day += 1) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  while (cells.length < 42) cells.push(null)

  const monthTitle = monthTitleFmt.format(new Date(activeView.y, activeView.m, 1))

  return (
    <Card
      className={cn(
        "gap-0 rounded-2xl border border-border bg-card py-0 shadow-sm shadow-slate-900/5",
        cardPad
      )}
    >
      {hideTitle ? null : (
        <CardHeader className="space-y-0 px-4 pb-2 pt-0 sm:px-5">
          <CardTitle className="text-sm sm:text-base">{t(titleKey)}</CardTitle>
        </CardHeader>
      )}
      <CardContent
        className={cn(
          "space-y-3 px-4 pb-4 sm:space-y-3.5 sm:px-5 sm:pb-4",
          hideTitle ? "pt-2" : "pt-0"
        )}
      >
        <div className={cn("mx-auto w-full space-y-2", gridMax)}>
          <div className="flex items-center justify-center gap-2 sm:gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              onClick={() => shiftMonth(-1)}
              aria-label={t("bookingPublic.prevMonth")}
            >
              <ChevronLeft className="size-3.5" aria-hidden />
            </Button>
            <div className="min-w-0 max-w-[14rem] sm:max-w-[18rem]">
              <p className="text-center text-sm font-semibold leading-snug text-foreground">
                {monthTitle}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              onClick={() => shiftMonth(1)}
              aria-label={t("bookingPublic.nextMonth")}
            >
              <ChevronRight className="size-3.5" aria-hidden />
            </Button>
          </div>

          <div
            className={cn(
              "mx-auto grid w-fit gap-1.5 pb-0.5",
              compact
                ? "grid-cols-[repeat(7,2.25rem)]"
                : "grid-cols-[repeat(7,2.5rem)] sm:grid-cols-[repeat(7,2.75rem)]"
            )}
          >
            {dowLabels.map((lbl) => (
              <div
                key={lbl}
                className="flex h-5 w-9 shrink-0 items-center justify-center sm:h-6 sm:w-10"
              >
                <span className="text-[9px] font-medium uppercase leading-none text-muted-foreground sm:text-[10px]">
                  {lbl}
                </span>
              </div>
            ))}
          </div>

          <div
            className={cn(
              "mx-auto grid w-fit gap-1.5 sm:gap-2",
              compact
                ? "grid-cols-[repeat(7,2.25rem)]"
                : "grid-cols-[repeat(7,2.5rem)] sm:grid-cols-[repeat(7,2.75rem)]"
            )}
          >
            {cells.map((day, idx) => {
              if (day === null) {
                return (
                  <div
                    key={`pad-${idx}`}
                    aria-hidden
                    className={cn("shrink-0", cellSize, cellSizeSm)}
                  />
                )
              }
              const cellDate = new Date(activeView.y, activeView.m, day)
              const key = toLocalDateKey(cellDate)
              const cellDayModel = useAvail
                ? resolveAvailabilityDaysForDate
                  ? resolveAvailabilityDaysForDate(cellDate)
                  : availability
                : availability
              const selectable = useAvail
                ? (() => {
                    if (typeof customSlotsForDate === "function") {
                      const cust = customSlotsForDate(cellDate)
                      if (cust != null) {
                        const k = toLocalDateKey(cellDate)
                        let out = cust.slice()
                        if (k === toLocalDateKey(clientToday)) {
                          out = filterSlotsNotInPast(out, k, asOf)
                        }
                        if (blockedSlotKeys && blockedSlotKeys.size > 0) {
                          out = out.filter((s) => !blockedSlotKeys.has(blockedSlotKey(k, s)))
                        }
                        return out.length > 0
                      }
                    }
                    return isDayOpenForAvailability(
                      cellDate,
                      clientToday,
                      asOf,
                      serviceDuration,
                      cellDayModel,
                      blockedSlotKeys
                    )
                  })()
                : legacySlotsForDate(cellDate, clientToday, asOf, blockedSlotKeys).length > 0
              const selected = selectedDateKey === key
              const isToday = toLocalDateKey(cellDate) === toLocalDateKey(clientToday)
              const showDot = selectable && !isToday

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!selectable}
                  onClick={() => {
                    onSelectDate(key)
                    onSelectTime(null)
                  }}
                  className={cn(
                    "relative flex shrink-0 flex-col items-center justify-center rounded-xl border text-[0.7rem] font-semibold transition-colors sm:text-xs",
                    cellSize,
                    cellSizeSm,
                    !selectable &&
                      "cursor-not-allowed border-transparent bg-muted/30 text-muted-foreground/35",
                    isToday && !selected && !selectable && "bg-muted/30 ring-[1.5px] ring-inset ring-primary/20",
                    selectable && !selected && "border-border/80 bg-card text-foreground hover:border-primary/40 hover:bg-muted/30",
                    isToday && selectable && !selected && "border-primary/25 ring-[1.5px] ring-inset ring-primary/30",
                    selected && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                  )}
                >
                  <span className="tabular-nums">{day}</span>
                  {showDot ? (
                    <span
                      className={cn(
                        "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full",
                        selected
                          ? "bg-primary-foreground/75"
                          : "bg-primary/35 dark:bg-primary/45"
                      )}
                      aria-hidden
                    />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className={cn(
            "mx-auto w-full space-y-2 border-t border-border/80 pt-3",
            gridMax
          )}
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t(slotsSubheadingKey)}
            </p>
            {selectedDate ? (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {selectedDayFmt.format(selectedDate)}
                {selectedTime ? (
                  <span className="text-foreground">
                    {" "}
                    · {selectedTime}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t(slotHelpKey)}
              </p>
            )}
          </div>

          {!selectedDate ? null : slots.length === 0 ? (
            <p className="text-xs text-muted-foreground sm:text-sm">
              {slotEmptyDetail === "closed"
                ? t("bookingPublic.dayUnavailable")
                : slotEmptyDetail === "service"
                  ? t("bookingPublic.serviceNotOnSelectedDay")
                  : t(emptySlotsKey)}
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((slot) => (
                <button
                    key={slot}
                    type="button"
                    onClick={() => onSelectTime(slot)}
                    className={cn(
                      "min-h-8 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                      selectedTime === slot
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                        : "border-border bg-muted/30 text-foreground hover:border-primary/35 hover:bg-muted/50 dark:bg-muted/20"
                    )}
                  >
                    {slot}
                  </button>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
