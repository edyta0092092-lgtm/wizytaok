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
  scheduleBlockLayoutTier,
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
  const showService = (tier === "full" || tier === "compact") && hasService && !isConfirmingCancel
  const blockHeightPx = isConfirmingCancel
    ? Math.max(heightPx, SCHEDULE_BLOCK_MIN_HEIGHT_CONFIRM_PX)
    : heightPx

  return (
    <div
      className={cn(
        "absolute inset-x-1.5 box-border flex min-w-0 flex-col overflow-hidden rounded-lg border shadow-sm",
        accentClassForStatus(entry.status),
        clipped && "ring-1 ring-amber-300/60",
        isConfirmingCancel && "z-30",
      )}
      style={{
        top: `${topPct}%`,
        height: blockHeightPx,
        maxWidth: "calc(100% - 0.75rem)",
        zIndex: isConfirmingCancel ? 30 : 10 + stackIndex,
        borderLeftWidth: 4,
        borderLeftColor: statusStripeColor(entry.status),
      }}
    >
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 items-center gap-2 overflow-hidden px-2.5",
          isConfirmingCancel ? "py-1.5" : "py-2",
        )}
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <p
            className={cn(
              "truncate font-medium text-foreground",
              tier === "minimal" ? "text-xs leading-4" : "text-sm leading-5",
            )}
            title={entry.client_name}
          >
            {entry.client_name}
          </p>
          {showService ? (
            <p className="truncate text-xs leading-4 text-muted-foreground" title={entry.service_name}>
              {entry.service_name}
            </p>
          ) : null}
        </div>

        {!isConfirmingCancel ? (
          <div className="flex shrink-0 items-center gap-0.5">
            {isCancelled ? (
              <span
                className={cn(
                  "inline-flex max-w-[5.5rem] items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4",
                  statusBadgeClassForStatus(entry.status),
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
                      "inline-flex max-w-[6.5rem] items-center gap-0.5 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50",
                      statusBadgeClassForStatus(entry.status),
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="truncate">{statusLabel(entry.status)}</span>
                    <ChevronDown className="size-3 shrink-0 opacity-70" aria-hidden />
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
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label={changeStatusLabel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
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
        <div className="space-y-1.5 border-t border-border/60 bg-background/90 px-2.5 py-2">
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
