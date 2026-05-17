"use client"

import * as React from "react"

import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { PanelFreeSlotsByDate } from "@/lib/schedule/compute-panel-free-slots"

type ScheduleFreeSlotsPanelProps = {
  title?: string
  monthLabel: string
  durationMinutes: number
  onDurationChange: (minutes: number) => void
  durationOptions: readonly number[]
  loading: boolean
  days: PanelFreeSlotsByDate[]
  selectedDate: string | null
  onSelectDate: (dateKey: string) => void
  formatDayHeading: (dateKey: string) => string
  className?: string
}

export function ScheduleFreeSlotsPanel({
  title,
  monthLabel,
  durationMinutes,
  onDurationChange,
  durationOptions,
  loading,
  days,
  selectedDate,
  onSelectDate,
  formatDayHeading,
  className,
}: ScheduleFreeSlotsPanelProps) {
  const { t } = useTranslations()
  const totalSlots = React.useMemo(
    () => days.reduce((sum, d) => sum + d.times.length, 0),
    [days],
  )

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5",
        className,
      )}
      aria-labelledby="schedule-free-slots-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id="schedule-free-slots-heading" className="text-base font-semibold text-foreground">
            {title ?? `${t("schedule.freeSlotsTitle")} — ${monthLabel}`}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("schedule.freeSlotsHint")}</p>
          {!loading && days.length > 0 ? (
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              {t("schedule.freeSlotsTotal").replace("{count}", String(totalSlots))}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <label htmlFor="sch-slot-duration" className="text-xs text-muted-foreground">
            {t("schedule.freeSlotsDuration")}
          </label>
          <select
            id="sch-slot-duration"
            className="h-9 min-w-[8rem] rounded-md border border-input bg-background px-2 text-sm"
            value={durationMinutes}
            onChange={(e) => onDurationChange(Number(e.target.value))}
          >
            {durationOptions.map((m) => (
              <option key={m} value={m}>
                {t("schedule.freeSlotsMinutes").replace("{n}", String(m))}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("schedule.freeSlotsLoading")}</p>
      ) : days.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("schedule.freeSlotsEmpty")}</p>
      ) : (
        <ul className="premium-scrollbar mt-4 max-h-[min(28rem,50vh)] space-y-3 overflow-y-auto pr-1">
          {days.map((day) => {
            const selected = selectedDate === day.date
            return (
              <li key={day.date}>
                <button
                  type="button"
                  onClick={() => onSelectDate(day.date)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                    selected
                      ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/80 bg-muted/10 hover:bg-muted/25",
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold capitalize text-foreground">
                      {formatDayHeading(day.date)}
                    </p>
                    <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      {t("schedule.freeSlotsCount").replace("{count}", String(day.times.length))}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground tabular-nums">
                    {day.times.length > 0
                      ? day.times.join(", ")
                      : t("schedule.freeSlotsDayEmpty")}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
