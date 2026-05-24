"use client"

import { Button } from "@/components/ui/button"
import { formatHm, scheduleCardTheme } from "@/lib/schedule/schedule-day-board"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

type DayScheduleMobileListProps = {
  entries: ScheduleDayEntry[]
  confirmCancelForId: string | null
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  cancelConfirmMessage: string
  cancelConfirmBack: string
  cancelConfirmAction: string
  loadingLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onRequestCancel: (id: string) => void
  onDismissCancel: () => void
  onConfirmCancel: (id: string) => void
}

export function DayScheduleMobileList({
  entries,
  confirmCancelForId,
  cancellingId,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  cancelConfirmMessage,
  cancelConfirmBack,
  cancelConfirmAction,
  loadingLabel,
  onChangeStatus,
  onRequestCancel,
  onDismissCancel,
  onConfirmCancel,
}: DayScheduleMobileListProps) {
  return (
    <div className="divide-y divide-border/80 overflow-y-auto px-4 py-2">
      {entries.map((row) => {
        const isCancelled = row.status === "cancelled"
        const isConfirmingCancel = confirmCancelForId === row.id
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
                {isConfirmingCancel ? (
                  <>
                    <p className="w-full text-xs text-muted-foreground">{cancelConfirmMessage}</p>
                    <Button type="button" variant="outline" size="sm" onClick={onDismissCancel}>
                      {cancelConfirmBack}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={cancellingId === row.id}
                      onClick={() => onConfirmCancel(row.id)}
                    >
                      {cancellingId === row.id ? loadingLabel : cancelConfirmAction}
                    </Button>
                  </>
                ) : (
                  <>
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
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => onRequestCancel(row.id)}>
                      {cancelLabel}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
