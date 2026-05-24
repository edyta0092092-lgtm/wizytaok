"use client"

import { ChevronDown, MoreVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  accentClassForStatus,
  statusBadgeClassForStatus,
  statusStripeColor,
} from "@/lib/schedule/schedule-day-board"
import {
  SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX,
  type ScheduleDayEntry,
} from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

type AppointmentBlockProps = {
  entry: ScheduleDayEntry
  topPx: number
  heightPx: number
  clipped?: boolean
  laneIndex?: number
  laneCount?: number
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

/** Dwie linie tekstu + padding mieszczą się od ~52px wysokości bloku. */
const TWO_LINE_MIN_HEIGHT_PX = 52

export function AppointmentBlock({
  entry,
  topPx,
  heightPx,
  clipped,
  laneIndex = 0,
  laneCount = 1,
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
  const blockHeightPx = isConfirmingCancel
    ? Math.max(heightPx, SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX)
    : heightPx
  const showService =
    !isConfirmingCancel && hasService && blockHeightPx >= TWO_LINE_MIN_HEIGHT_PX
  const compactControls = blockHeightPx < TWO_LINE_MIN_HEIGHT_PX
  const laneWidthPct = 100 / laneCount
  const laneLeftPct = laneIndex * laneWidthPct

  return (
    <div
      className={cn(
        "absolute box-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm",
        accentClassForStatus(entry.status),
        clipped && "ring-1 ring-amber-300/60",
        isConfirmingCancel && "z-30",
      )}
      style={{
        top: topPx,
        height: blockHeightPx,
        left: `calc(${laneLeftPct}% + 4px)`,
        width: `calc(${laneWidthPct}% - 8px)`,
        zIndex: isConfirmingCancel ? 30 : 10 + stackIndex,
        borderLeftWidth: 4,
        borderLeftColor: statusStripeColor(entry.status),
      }}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden px-2",
          showService ? "items-start py-1.5" : "items-center py-1",
        )}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <p
            className={cn(
              "truncate font-medium leading-4 text-foreground",
              showService ? "text-sm leading-5" : "text-xs",
            )}
            title={entry.client_name}
          >
            {entry.client_name}
          </p>
          {showService ? (
            <p
              className="mt-0.5 truncate text-xs leading-4 text-muted-foreground"
              title={entry.service_name}
            >
              {entry.service_name}
            </p>
          ) : null}
        </div>

        {!isConfirmingCancel ? (
          <div className="flex shrink-0 items-center gap-0.5 self-center">
            {isCancelled ? (
              <span
                className={cn(
                  "inline-flex max-w-[4.75rem] items-center truncate rounded-full border px-1.5 py-px text-[9px] font-medium leading-4",
                  statusBadgeClassForStatus(entry.status),
                  compactControls && "max-w-[3.75rem]",
                )}
                title={statusLabel(entry.status)}
              >
                {statusLabel(entry.status)}
              </span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={changeStatusLabel}
                    className={cn(
                      "inline-flex max-w-[5.5rem] shrink-0 items-center gap-0.5 truncate rounded-full border px-1.5 py-px text-[9px] font-medium leading-4 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50",
                      statusBadgeClassForStatus(entry.status),
                      compactControls && "max-w-[4.25rem]",
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{statusLabel(entry.status)}</span>
                    <ChevronDown className="size-2.5 shrink-0 opacity-70" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[9rem]">
                  {statusMenuOrder.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onChangeStatus(entry.id, status)}
                    >
                      {statusLabel(status)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    "shrink-0 text-muted-foreground hover:text-foreground",
                    compactControls ? "size-6" : "size-7",
                  )}
                  aria-label={changeStatusLabel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className={compactControls ? "size-3.5" : "size-4"} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                {!isCancelled
                  ? statusMenuOrder.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => onChangeStatus(entry.id, status)}
                      >
                        {statusLabel(status)}
                      </DropdownMenuItem>
                    ))
                  : null}
                {!isCancelled ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onRequestCancel(entry.id)}
                  >
                    {cancelLabel}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {isConfirmingCancel ? (
        <div className="shrink-0 space-y-1.5 border-t border-border/60 bg-background/95 px-2 py-1.5">
          <p className="text-[10px] leading-snug text-muted-foreground">{cancelConfirmMessage}</p>
          <div className="flex gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-7 flex-1 text-xs" onClick={onDismissCancel}>
              {cancelConfirmBack}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 flex-1 text-xs"
              disabled={isCancelling}
              onClick={onConfirmCancel}
            >
              {isCancelling ? loadingLabel : cancelConfirmAction}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
