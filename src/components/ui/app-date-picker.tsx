"use client"

import * as React from "react"
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  setMonth,
  setYear,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { pl } from "date-fns/locale"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function parseLocalDate(iso: string): Date {
  return parseISO(`${iso}T12:00:00`)
}

function toIsoDate(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function displayDate(iso: string): string {
  return format(parseLocalDate(iso), "dd.MM.yyyy", { locale: pl })
}

function clampViewMonth(d: Date, min?: string, max?: string): Date {
  let next = d
  if (min) {
    const minStart = startOfMonth(parseLocalDate(min))
    if (isBefore(next, minStart)) next = minStart
  }
  if (max) {
    const maxStart = startOfMonth(parseLocalDate(max))
    if (isAfter(next, maxStart)) next = maxStart
  }
  return next
}

export type AppDatePickerProps = {
  id?: string
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  min?: string
  max?: string
  className?: string
  /** When true, popover closes after picking a day. */
  closeOnSelect?: boolean
}

export function AppDatePicker({
  id,
  value,
  onChange,
  placeholder = "Wybierz datę",
  disabled,
  required,
  min,
  max,
  className,
  closeOnSelect = true,
}: AppDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [viewMonth, setViewMonth] = React.useState(() =>
    startOfMonth(new Date()),
  )

  const selected = ISO_DATE.test(value) ? value : undefined

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      const base =
        selected != null
          ? parseLocalDate(selected)
          : min
            ? parseLocalDate(min)
            : new Date()
      setViewMonth(clampViewMonth(startOfMonth(base), min, max))
    }
  }

  const display =
    selected != null && ISO_DATE.test(value) ? displayDate(value) : ""

  const yearFrom = React.useMemo(() => {
    const y = viewMonth.getFullYear()
    let lo = y - 80
    let hi = y + 20
    if (min) lo = Math.min(lo, parseLocalDate(min).getFullYear())
    if (max) hi = Math.max(hi, parseLocalDate(max).getFullYear())
    return { lo, hi }
  }, [viewMonth, min, max])

  const years = React.useMemo(() => {
    const out: number[] = []
    for (let y = yearFrom.lo; y <= yearFrom.hi; y++) out.push(y)
    return out
  }, [yearFrom])

  const months = React.useMemo(
    () => Array.from({ length: 12 }, (_, idx) => idx),
    [],
  )

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const weekdayLabels = React.useMemo(() => {
    const refMonday = parseISO("2024-01-01T12:00:00")
    const weekStart = startOfWeek(refMonday, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) =>
      format(addDays(weekStart, i), "EEE", { locale: pl })
        .replace(".", "")
        .slice(0, 2),
    )
  }, [])

  function disabledDay(day: Date) {
    if (min && isBefore(day, parseLocalDate(min))) return true
    if (max && isAfter(day, parseLocalDate(max))) return true
    return false
  }

  function pickDay(day: Date) {
    if (disabledDay(day)) return
    onChange(toIsoDate(day))
    if (closeOnSelect) setOpen(false)
  }

  function bumpMonth(delta: number) {
    setViewMonth((m) => clampViewMonth(addMonths(m, delta), min, max))
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-required={required || undefined}
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-2 rounded-2xl border border-input bg-card px-3 text-left text-sm transition-colors outline-none",
            "hover:bg-muted/55 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45",
            "disabled:pointer-events-none disabled:opacity-65",
            "dark:bg-input/20 dark:hover:bg-muted/55",
            !display && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{display || placeholder}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="p-3 md:p-4" aria-label="Wybór daty">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-xl"
            aria-label="Poprzedni miesiąc"
            onClick={() => bumpMonth(-1)}
          >
            <ChevronLeftIcon className="size-5" aria-hidden />
          </Button>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Select
              value={String(viewMonth.getMonth())}
              onValueChange={(v) => {
                const m = clampViewMonth(
                  setMonth(viewMonth, Number(v)),
                  min,
                  max,
                )
                setViewMonth(m)
              }}
            >
              <SelectTrigger
                aria-label="Miesiąc"
                size="sm"
                className="min-w-0 flex-1 rounded-xl capitalize"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[110] capitalize" position="popper">
                {months.map((monthIdx) => {
                  const named = format(
                    new Date(viewMonth.getFullYear(), monthIdx, 1),
                    "LLLL",
                    { locale: pl },
                  )
                  const label =
                    named.length > 0
                      ? named.replace(/^\w/, (c) => c.toUpperCase())
                      : String(monthIdx + 1)
                  return (
                    <SelectItem key={monthIdx} value={String(monthIdx)}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Select
              value={String(viewMonth.getFullYear())}
              onValueChange={(v) =>
                setViewMonth(
                  clampViewMonth(setYear(viewMonth, Number(v)), min, max),
                )
              }
            >
              <SelectTrigger
                aria-label="Rok"
                size="sm"
                className="w-[104px] shrink-0 rounded-xl"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[110] max-h-[min(18rem,var(--radix-select-content-available-height))]" position="popper">
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {String(y)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-xl"
            aria-label="Następny miesiąc"
            onClick={() => bumpMonth(1)}
          >
            <ChevronRightIcon className="size-5" aria-hidden />
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {weekdayLabels.map((w) => (
            <div key={w} className="flex h-8 items-center justify-center">
              {w}
            </div>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-1">
          {gridDays.map((day) => {
            const inMonth = isSameMonth(day, viewMonth)
            const selectedHere = Boolean(selected && isSameDay(day, parseLocalDate(selected)))
            const today = isToday(day)
            const off = disabledDay(day)

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={off}
                onClick={() => pickDay(day)}
                aria-current={selectedHere ? "date" : undefined}
                aria-label={format(day, "EEEE d LLLL yyyy", { locale: pl })}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-xl text-sm transition-colors outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/45",
                  !inMonth && "text-muted-foreground/45",
                  inMonth && "text-foreground",
                  off && "cursor-not-allowed opacity-40 pointer-events-none",
                  !off &&
                    !selectedHere &&
                    "hover:bg-accent/85 hover:text-accent-foreground",
                  selectedHere &&
                    "border border-primary bg-primary font-semibold text-primary-foreground shadow-sm",
                  today &&
                    !selectedHere &&
                    "ring-2 ring-ring/45 ring-offset-2 ring-offset-popover dark:ring-offset-popover",
                )}
              >
                {format(day, "d")}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
