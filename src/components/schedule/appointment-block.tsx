"use client"

import { Button } from "@/components/ui/button"
import { accentClassForStatus, accentStripeForService } from "@/lib/schedule/schedule-day-board"
import {
  SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX,
  type ScheduleDayEntry,
} from "@/lib/schedule/schedule-day-types"
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
  const blockHeightPx = Math.max(
    heightPx,
    isConfirmingCancel ? SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX : 0,
  )
  const showService = blockHeightPx >= 80 && Boolean(entry.service_name?.trim())

  return (
    <div
      className={cn(
        "absolute inset-x-1 z-10 box-border flex min-w-0 flex-col overflow-hidden rounded-lg border px-2 py-1.5",
        accentClassForStatus(entry.status),
        clipped && "ring-1 ring-amber-300/60",
      )}
      style={{
        top: `${topPct}%`,
        height: blockHeightPx,
        minHeight: blockHeightPx,
        maxWidth: "calc(100% - 0.5rem)",
        borderLeftWidth: 3,
        borderLeftColor: accentStripeForService(entry.service_name),
      }}
    >
      <div className="shrink-0 space-y-1">
        <p
          className="truncate text-sm font-medium leading-5 text-foreground"
          title={entry.client_name}
        >
          {entry.client_name}
        </p>
        {showService ? (
          <p
            className="truncate text-xs leading-4 text-muted-foreground"
            title={entry.service_name}
          >
            {entry.service_name}
          </p>
        ) : null}
      </div>

      {isConfirmingCancel ? (
        <div className="mt-2 shrink-0 space-y-1.5 overflow-hidden rounded-md bg-background/80 p-1.5">
          <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{cancelConfirmMessage}</p>
          <div className="grid min-w-0 grid-cols-2 gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 min-w-0 truncate px-1 text-[10px]"
              onClick={onDismissCancel}
            >
              {cancelConfirmBack}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 min-w-0 truncate px-1 text-[10px]"
              disabled={isCancelling}
              onClick={onConfirmCancel}
            >
              {isCancelling ? loadingLabel : cancelConfirmAction}
            </Button>
          </div>
        </div>
      ) : !isCancelled ? (
        <div className="mt-2 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
          <select
            aria-label={changeStatusLabel}
            className="h-7 w-full min-w-0 rounded-md border border-input/80 bg-background/90 px-1 text-[10px] leading-none text-foreground"
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
            className="max-w-[4.5rem] shrink-0 truncate text-[10px] font-medium leading-4 text-destructive hover:underline"
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
        <p
          className="mt-2 shrink-0 truncate text-[10px] leading-4 text-muted-foreground"
          title={statusLabel(entry.status)}
        >
          {statusLabel(entry.status)}
        </p>
      )}
    </div>
  )
}
