"use client"

import { ScheduleVisitCardDetails } from "@/components/schedule/schedule-visit-card-details"
import { Button } from "@/components/ui/button"
import { isAppointmentVisitLocked } from "@/lib/appointments/appointment-visit-lock"
import { scheduleCardTheme } from "@/lib/schedule/schedule-day-board"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

type DayScheduleMobileListProps = {
  entries: ScheduleDayEntry[]
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  staffFallbackLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
}

export function DayScheduleMobileList({
  entries,
  cancellingId,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  staffFallbackLabel,
  onChangeStatus,
  onCancelVisit,
}: DayScheduleMobileListProps) {
  return (
    <div className="divide-y divide-border/80 overflow-y-auto px-4 py-2">
      {entries.map((row) => {
        const visitLocked = isAppointmentVisitLocked(row.status)
        return (
          <div key={row.id} className={cn("my-2 rounded-lg border px-3 py-3", scheduleCardTheme(row).cardClass)}>
            <ScheduleVisitCardDetails
              entry={row}
              staffFallback={staffFallbackLabel}
              className="gap-3"
            />
            {!visitLocked ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  aria-label={changeStatusLabel}
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={row.status}
                  onChange={(e) => onChangeStatus(row.id, e.target.value as AppointmentStatus)}
                >
                  {statusMenuOrder.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={cancellingId === row.id}
                  onClick={() => onCancelVisit(row.id)}
                >
                  {cancelLabel}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs font-medium text-muted-foreground">{statusLabel(row.status)}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
