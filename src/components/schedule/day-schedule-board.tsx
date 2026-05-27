"use client"

import {
  buildHalfHourSlotLabels,
  getScheduleBoardRangeMinutes,
  layoutColumnBlocks,
  scheduleBoardGridHeightPx,
  scheduleBoardSlotHeightPx,
  staffInitials,
} from "@/lib/schedule/schedule-day-board"
import type { ScheduleStaffColumn } from "@/lib/schedule/schedule-day-types"
import {
  SCHEDULE_BOARD_HEADER_HEIGHT_PX,
  SCHEDULE_BOARD_TIME_COLUMN_WIDTH_PX,
} from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

import { DayScheduleAppointmentCard } from "@/components/schedule/day-schedule-appointment-card"

type DayScheduleBoardProps = {
  columns: ScheduleStaffColumn[]
  visitCountLabel: (count: number) => string
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  staffFallbackLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
}

function TimeAxisColumn({ gridHeightPx }: { gridHeightPx: number }) {
  const labels = buildHalfHourSlotLabels()
  const slotHeightPx = scheduleBoardSlotHeightPx()
  const range = getScheduleBoardRangeMinutes()

  return (
    <div
      className="sticky left-0 z-20 shrink-0 border-r border-border/70 bg-background"
      style={{ width: SCHEDULE_BOARD_TIME_COLUMN_WIDTH_PX }}
    >
      <div
        className="flex items-end border-b border-border/70 bg-[#f8faf9] px-2 pb-2 dark:bg-muted/20"
        style={{ height: SCHEDULE_BOARD_HEADER_HEIGHT_PX }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Godzina</span>
      </div>
      <div className="relative bg-background" style={{ height: gridHeightPx }}>
        {labels.map((label) => {
          const [h, m] = label.split(":").map(Number)
          const topPx = (h * 60 + m - range.start) * (slotHeightPx / 30)
          return (
            <span
              key={label}
              className="pointer-events-none absolute inset-x-0 px-2 text-[11px] font-medium tabular-nums text-muted-foreground"
              style={{ top: topPx, lineHeight: 1 }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function StaffColumn({
  column,
  gridHeightPx,
  visitCountLabel,
  blockLayouts,
  cancellingId,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  staffFallbackLabel,
  onChangeStatus,
  onCancelVisit,
}: {
  column: ScheduleStaffColumn
  gridHeightPx: number
  visitCountLabel: (count: number) => string
  blockLayouts: ReturnType<typeof layoutColumnBlocks>
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  staffFallbackLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
}) {
  const slotHeightPx = scheduleBoardSlotHeightPx()

  return (
    <div className="flex min-w-[11.5rem] flex-1 flex-col border-r border-border/70 last:border-r-0">
      <div
        className="flex shrink-0 items-center gap-2.5 border-b border-border/70 bg-[#f8faf9] px-3 dark:bg-muted/20"
        style={{ height: SCHEDULE_BOARD_HEADER_HEIGHT_PX }}
      >
        <span
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/12 text-xs font-bold text-primary"
          aria-hidden
        >
          {staffInitials(column.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{column.name}</p>
          <p className="truncate text-xs text-muted-foreground">{visitCountLabel(column.entries.length)}</p>
        </div>
      </div>

      <div
        className="relative isolate bg-background"
        style={{
          height: gridHeightPx,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${slotHeightPx}px - 1px), hsl(var(--border) / 0.55) calc(${slotHeightPx}px - 1px), hsl(var(--border) / 0.55) ${slotHeightPx}px)`,
          backgroundSize: `100% ${slotHeightPx}px`,
        }}
      >
        {column.entries.map((entry) => {
          const layout = blockLayouts.get(entry.id)
          if (!layout) return null
          return (
            <DayScheduleAppointmentCard
              key={entry.id}
              entry={entry}
              topPx={layout.topPx}
              heightPx={layout.heightPx}
              laneIndex={layout.laneIndex}
              laneCount={layout.laneCount}
              clipped={layout.clipped}
              isCancelling={cancellingId === entry.id}
              statusMenuOrder={statusMenuOrder}
              statusLabel={statusLabel}
              changeStatusLabel={changeStatusLabel}
              cancelLabel={cancelLabel}
              staffFallbackLabel={staffFallbackLabel}
              onChangeStatus={onChangeStatus}
              onCancelVisit={onCancelVisit}
            />
          )
        })}
      </div>
    </div>
  )
}

export function DayScheduleBoard({
  columns,
  visitCountLabel,
  cancellingId,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  staffFallbackLabel,
  onChangeStatus,
  onCancelVisit,
}: DayScheduleBoardProps) {
  const range = getScheduleBoardRangeMinutes()
  const gridHeightPx = scheduleBoardGridHeightPx()

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden")}>
      <div className="premium-scrollbar min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-full" style={{ minWidth: SCHEDULE_BOARD_TIME_COLUMN_WIDTH_PX + columns.length * 184 }}>
          <TimeAxisColumn gridHeightPx={gridHeightPx} />
          {columns.map((column) => (
            <StaffColumn
              key={column.id}
              column={column}
              gridHeightPx={gridHeightPx}
              visitCountLabel={visitCountLabel}
              blockLayouts={layoutColumnBlocks(column.entries, range)}
              cancellingId={cancellingId}
              statusMenuOrder={statusMenuOrder}
              statusLabel={statusLabel}
              changeStatusLabel={changeStatusLabel}
              cancelLabel={cancelLabel}
              staffFallbackLabel={staffFallbackLabel}
              onChangeStatus={onChangeStatus}
              onCancelVisit={onCancelVisit}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function scheduleGridHeightPx(): number {
  return scheduleBoardGridHeightPx()
}
