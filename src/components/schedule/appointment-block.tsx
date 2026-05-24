"use client"

import { Button } from "@/components/ui/button"
import {
  accentClassForStatus,
  accentStripeForService,
  scheduleBlockLayoutTier,
} from "@/lib/schedule/schedule-day-board"
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
  stackIndex?: number
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

function StatusActions({
  entry,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  compact,
  onChangeStatus,
  onRequestCancel,
}: {
  entry: ScheduleDayEntry
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  compact?: boolean
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onRequestCancel: (id: string) => void
}) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center",
        compact ? "h-5 gap-0.5" : "h-7 gap-1",
      )}
    >
      <select
        aria-label={changeStatusLabel}
        className={cn(
          "w-full min-w-0 rounded border border-input/80 bg-background/90 px-1 text-[10px] leading-none text-foreground",
          compact ? "h-5" : "h-7",
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
          "shrink-0 truncate font-medium text-destructive hover:underline",
          compact ? "max-w-[3rem] text-[9px] leading-3" : "max-w-[4rem] text-[10px] leading-4",
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
  )
}

export function AppointmentBlock({
  entry,
  topPct,
  heightPx,
  clipped,
  stackIndex = 0,
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
  const hasService = Boolean(entry.service_name?.trim())
  const tier = scheduleBlockLayoutTier(heightPx, { hasService, isCancelled })
  const showService = tier === "full" && hasService
  const blockHeightPx = isConfirmingCancel
    ? Math.max(heightPx, SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX)
    : heightPx

  return (
    <div
      className={cn(
        "absolute inset-x-1 box-border flex min-w-0 flex-col overflow-hidden rounded-lg border",
        tier === "minimal" ? "gap-0.5 px-1.5 py-1" : "gap-1 px-2 py-1.5",
        accentClassForStatus(entry.status),
        clipped && "ring-1 ring-amber-300/60",
        isConfirmingCancel && "z-30 shadow-md",
      )}
      style={{
        top: `${topPct}%`,
        height: blockHeightPx,
        maxWidth: "calc(100% - 0.5rem)",
        zIndex: isConfirmingCancel ? 30 : 10 + stackIndex,
        borderLeftWidth: 3,
        borderLeftColor: accentStripeForService(entry.service_name),
      }}
    >
      {isConfirmingCancel ? (
        <>
          <div className="h-5 shrink-0 overflow-hidden">
            <p className="truncate text-sm font-medium leading-5 text-foreground" title={entry.client_name}>
              {entry.client_name}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-hidden rounded-md bg-background/80 p-1">
            <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{cancelConfirmMessage}</p>
            <div className="grid grid-cols-2 gap-1">
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
        </>
      ) : (
        <>
          <div
            className={cn(
              "shrink-0 overflow-hidden",
              tier === "minimal" ? "h-4" : "h-5",
            )}
          >
            <p
              className={cn(
                "truncate font-medium text-foreground",
                tier === "minimal" ? "text-[11px] leading-4" : "text-sm leading-5",
              )}
              title={entry.client_name}
            >
              {entry.client_name}
            </p>
          </div>

          {showService ? (
            <div className="h-4 shrink-0 overflow-hidden">
              <p className="truncate text-xs leading-4 text-muted-foreground" title={entry.service_name}>
                {entry.service_name}
              </p>
            </div>
          ) : null}

          <div
            className={cn(
              "mt-auto shrink-0 overflow-hidden",
              isCancelled ? "h-4" : tier === "minimal" ? "h-5" : "h-7",
            )}
          >
            {isCancelled ? (
              <p className="truncate text-[10px] leading-4 text-muted-foreground" title={statusLabel(entry.status)}>
                {statusLabel(entry.status)}
              </p>
            ) : (
              <StatusActions
                entry={entry}
                statusMenuOrder={statusMenuOrder}
                statusLabel={statusLabel}
                changeStatusLabel={changeStatusLabel}
                cancelLabel={cancelLabel}
                compact={tier === "minimal"}
                onChangeStatus={onChangeStatus}
                onRequestCancel={onRequestCancel}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
