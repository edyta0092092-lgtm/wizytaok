"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { ScheduleMobileDayTimeline } from "@/components/schedule/schedule-mobile-day-timeline"
import { ScheduleMobileFab } from "@/components/schedule/schedule-mobile-fab"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import type { AppointmentStatus, StaffMember } from "@/types/domain"

type ScheduleMobileViewProps = {
  selectedDate: string
  todayKey: string
  onSelectedDateChange: (next: string) => void
  dayTitle: string
  visitSummary: string
  entries: ScheduleDayEntry[]
  staffMembers: StaffMember[]
  personFilter: string
  onPersonFilterChange: (next: string) => void
  loading: boolean
  loadError: boolean
  statusNotice: string
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  visitCountLabel: (count: number) => string
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  staffFallbackLabel: string
  emptyLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
}

function shiftDateKey(isoDate: string, deltaDays: number): string {
  const d = new Date(
    Number(isoDate.slice(0, 4)),
    Number(isoDate.slice(5, 7)) - 1,
    Number(isoDate.slice(8, 10)),
  )
  d.setDate(d.getDate() + deltaDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function ScheduleMobileView({
  selectedDate,
  todayKey,
  onSelectedDateChange,
  dayTitle,
  visitSummary,
  entries,
  staffMembers,
  personFilter,
  onPersonFilterChange,
  loading,
  loadError,
  statusNotice,
  cancellingId,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  staffFallbackLabel,
  emptyLabel,
  onChangeStatus,
  onCancelVisit,
}: ScheduleMobileViewProps) {
  const { t } = useTranslations()
  const isToday = selectedDate === todayKey

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-sm shadow-slate-900/5">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 touch-manipulation rounded-xl"
            onClick={() => onSelectedDateChange(shiftDateKey(selectedDate, -1))}
            aria-label={t("schedule.prevDay")}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold capitalize leading-snug text-foreground">{dayTitle}</p>
            <p className="text-xs text-muted-foreground">{visitSummary}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 touch-manipulation rounded-xl"
            onClick={() => onSelectedDateChange(shiftDateKey(selectedDate, 1))}
            aria-label={t("schedule.nextDay")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={isToday ? "default" : "outline"}
            size="sm"
            className="h-11 w-full touch-manipulation rounded-xl"
            onClick={() => onSelectedDateChange(todayKey)}
          >
            {t("schedule.today")}
          </Button>
          {staffMembers.length > 0 ? (
            <div className="min-w-0">
              <Label htmlFor="schedule-mobile-person" className="sr-only">
                {t("schedule.filterPerson")}
              </Label>
              <select
                id="schedule-mobile-person"
                className="h-11 w-full touch-manipulation rounded-xl border border-input bg-background px-3 text-base sm:h-10 sm:text-sm"
                value={personFilter}
                onChange={(e) => onPersonFilterChange(e.target.value)}
              >
                <option value="">{t("schedule.filterPersonAll")}</option>
                {staffMembers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      {statusNotice ? (
        <p className="rounded-xl border border-border/80 bg-muted/40 px-3 py-2 text-sm text-foreground">
          {statusNotice}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("schedule.loadingData")}</p>
      ) : loadError ? (
        <p className="text-sm text-destructive">{t("schedule.loadError")}</p>
      ) : (
        <ScheduleMobileDayTimeline
          entries={entries}
          isToday={isToday}
          cancellingId={cancellingId}
          statusMenuOrder={statusMenuOrder}
          statusLabel={statusLabel}
          changeStatusLabel={changeStatusLabel}
          cancelLabel={cancelLabel}
          staffFallbackLabel={staffFallbackLabel}
          emptyLabel={emptyLabel}
          onChangeStatus={onChangeStatus}
          onCancelVisit={onCancelVisit}
        />
      )}

      <ScheduleMobileFab />
    </div>
  )
}
