"use client"

import { ChevronDown, MoreVertical } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { scheduleCardTheme } from "@/lib/schedule/schedule-day-board"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

export type DayScheduleAppointmentCardProps = {
  entry: ScheduleDayEntry
  topPx: number
  heightPx: number
  laneIndex: number
  laneCount: number
  clipped?: boolean
  isCancelling: boolean
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
}

export function DayScheduleAppointmentCard({
  entry,
  topPx,
  heightPx,
  laneIndex,
  laneCount,
  clipped,
  isCancelling,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  onChangeStatus,
  onCancelVisit,
}: DayScheduleAppointmentCardProps) {
  const theme = scheduleCardTheme(entry)
  const isCancelled = entry.status === "cancelled"
  const showService = heightPx >= 48 && Boolean(entry.service_name?.trim())
  const laneWidthPct = 100 / laneCount
  const laneLeftPct = laneIndex * laneWidthPct

  return (
    <article
      className={cn(
        "absolute box-border overflow-hidden rounded-lg border shadow-sm",
        theme.cardClass,
        clipped && "ring-1 ring-amber-400/50",
      )}
      style={{
        top: topPx,
        height: heightPx,
        left: `calc(${laneLeftPct}% + 5px)`,
        width: `calc(${laneWidthPct}% - 10px)`,
        borderLeftWidth: 4,
        borderLeftColor: theme.stripeColor,
        zIndex: 20 + laneIndex,
      }}
    >
      <div
        className={cn(
          "flex h-full min-w-0 items-center gap-2 px-2.5",
          showService ? "py-2" : "py-1.5",
        )}
      >
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold leading-5 text-foreground" title={entry.client_name}>
            {entry.client_name}
          </p>
          {showService ? (
            <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground" title={entry.service_name}>
              {entry.service_name}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isCancelled ? (
            <span
              className={cn(
                "inline-flex max-w-[5.75rem] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4",
                theme.badgeClass,
              )}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", theme.dotClass)} aria-hidden />
              <span className="truncate">{statusLabel(entry.status)}</span>
            </span>
          ) : (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={changeStatusLabel}
                  className={cn(
                    "inline-flex max-w-[6.75rem] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 outline-none hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring/40",
                    theme.badgeClass,
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", theme.dotClass)} aria-hidden />
                  <span className="truncate">{statusLabel(entry.status)}</span>
                  <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] min-w-[9.5rem]">
                {statusMenuOrder.map((status) => (
                  <DropdownMenuItem key={status} onSelect={() => onChangeStatus(entry.id, status)}>
                    {statusLabel(status)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isCancelled ? (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 shrink-0 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  aria-label={changeStatusLabel}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] min-w-[10rem]">
                <DropdownMenuItem
                  variant="destructive"
                  disabled={isCancelling}
                  onSelect={() => onCancelVisit(entry.id)}
                >
                  {cancelLabel}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </article>
  )
}
