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
  const tight = heightPx < 56

  return (
    <div
      className={cn(
        "absolute inset-x-1 z-10 flex min-w-0 flex-col overflow-hidden rounded-lg border",
        tight ? "px-1.5 py-1" : "px-2 py-1.5",
        accentClassForStatus(entry.status),
        clipped && "ring-1 ring-amber-300/60",
      )}
      style={{
        top: `${topPct}%`,
        height: `${heightPx}px`,
        maxWidth: "calc(100% - 0.5rem)",
        borderLeftWidth: 3,
        borderLeftColor: accentStripeForService(entry.service_name),
      }}
    >
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-0.5">
        <div className="min-w-0 shrink-0 space-y-0.5">
          <p
            className={cn(
              "truncate font-medium leading-tight text-foreground",
              compact ? "text-xs" : "text-sm",
            )}
            title={entry.client_name}
          >
            {entry.client_name}
          </p>
          {!compact && entry.service_name ? (
            <p className="truncate text-[11px] leading-tight text-muted-foreground" title={entry.service_name}>
              {entry.service_name}
            </p>
          ) : null}
        </div>

        {isConfirmingCancel ? (
          <div className="mt-auto min-w-0 space-y-1 overflow-hidden rounded-md bg-background/80 p-1">
            <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{cancelConfirmMessage}</p>
            <div className="grid min-w-0 grid-cols-2 gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 min-w-0 truncate px-1 text-[10px]"
                onClick={onDismissCancel}
              >
                {cancelConfirmBack}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-6 min-w-0 truncate px-1 text-[10px]"
                disabled={isCancelling}
                onClick={onConfirmCancel}
              >
                {isCancelling ? loadingLabel : cancelConfirmAction}
              </Button>
            </div>
          </div>
        ) : !isCancelled ? (
          <div className="mt-auto grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1">
            <select
              aria-label={changeStatusLabel}
              className={cn(
                "h-6 w-full min-w-0 truncate rounded-md border border-input/80 bg-background/90 text-[10px] text-foreground",
                tight ? "px-0.5" : "px-1",
              )}
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
              className={cn(
                "max-w-[4.25rem] shrink-0 truncate text-[10px] font-medium text-destructive hover:underline",
                tight && "max-w-[3.25rem]",
              )}
              title={cancelLabel}
              onClick={(e) => {
                e.stopPropagation()
                onRequestCancel(entry.id)
              }}
            >
              {cancelLabel}
            </button>
          </div>
        ) : (
          <p className="mt-auto truncate text-[10px] leading-tight text-muted-foreground" title={statusLabel(entry.status)}>
            {statusLabel(entry.status)}
          </p>
        )}
      </div>
    </div>
  )
}
