"use client"

import { Button } from "@/components/ui/button"
import { accentClassForStatus, accentStripeForService } from "@/lib/schedule/schedule-day-board"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

type AppointmentBlockProps = {
  entry: ScheduleDayEntry
  topPct: number
  heightPx: number
  clipped?: boolean
  statusMenuOrder: AppointmentStatus[]
  isConfirmingCancel: boolean
  isCancelling: boolean
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
  onConfirmCancel: () => void
}

export function AppointmentBlock({
  entry,
  topPct,
  heightPx,
  clipped,
  statusMenuOrder,
  isConfirmingCancel,
  isCancelling,
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
}: AppointmentBlockProps) {
  const isCancelled = entry.status === "cancelled"
  const compact = heightPx < 72

  return (
    <div
      className={cn(
        "absolute right-1 left-1 z-10 overflow-hidden rounded-lg border px-2 py-1.5",
        accentClassForStatus(entry.status),
        clipped && "ring-1 ring-amber-300/60",
      )}
      style={{
        top: `${topPct}%`,
        height: `${heightPx}px`,
        borderLeftWidth: 3,
        borderLeftColor: accentStripeForService(entry.service_name),
      }}
    >
      <div className="flex min-h-0 flex-col gap-1">
        <p className={cn("truncate font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
          {entry.client_name}
        </p>
        {!compact ? (
          <p className="truncate text-xs text-muted-foreground">{entry.service_name}</p>
        ) : null}

        {isConfirmingCancel ? (
          <div className="mt-auto space-y-1 rounded-md bg-background/80 p-1.5">
            <p className="text-[10px] leading-snug text-muted-foreground">{cancelConfirmMessage}</p>
            <div className="flex flex-wrap gap-1">
              <Button type="button" variant="outline" size="sm" className="h-6 px-1.5 text-[10px]" onClick={onDismissCancel}>
                {cancelConfirmBack}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                disabled={isCancelling}
                onClick={onConfirmCancel}
              >
                {isCancelling ? loadingLabel : cancelConfirmAction}
              </Button>
            </div>
          </div>
        ) : !isCancelled ? (
          <div className={cn("mt-auto flex flex-wrap items-center gap-1", compact && "gap-0.5")}>
            <select
              aria-label={changeStatusLabel}
              className="h-6 max-w-full min-w-0 flex-1 rounded border border-input/80 bg-background/90 px-1 text-[10px] text-foreground sm:text-xs"
              value={entry.status}
              onChange={(e) => onChangeStatus(entry.id, e.target.value as AppointmentStatus)}
              onClick={(e) => e.stopPropagation()}
            >
              {statusMenuOrder.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="shrink-0 text-[10px] font-medium text-destructive hover:underline sm:text-xs"
              onClick={(e) => {
                e.stopPropagation()
                onRequestCancel(entry.id)
              }}
            >
              {cancelLabel}
            </button>
          </div>
        ) : (
          <p className="mt-auto text-[10px] text-muted-foreground">{statusLabel(entry.status)}</p>
        )}
      </div>
    </div>
  )
}
