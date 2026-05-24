"use client"

import { Button } from "@/components/ui/button"
import { formatHm, scheduleCardTheme } from "@/lib/schedule/schedule-day-board"
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
  onChangeStatus,
  onCancelVisit,
}: DayScheduleMobileListProps) {
  return (
    <div className="divide-y divide-border/80 overflow-y-auto px-4 py-2">
      {entries.map((row) => {
        const isCancelled = row.status === "cancelled"
        const staff = row.staff_name?.trim()
        return (
          <div key={row.id} className={cn("my-2 rounded-lg border px-3 py-3", scheduleCardTheme(row).cardClass)}>
            <div className="flex gap-3">
              <p className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatHm(row.appointment_time)}</p>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{row.client_name}</p>
                <p className="text-sm text-muted-foreground">{row.service_name}</p>
                {staff ? <p className="text-xs text-muted-foreground">{staff}</p> : null}
              </div>
            </div>
            {!isCancelled ? (
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
              <p className="mt-2 text-xs font-medium text-muted-foreground">{statusLabel("cancelled")}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
