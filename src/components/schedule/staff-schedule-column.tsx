"use client"

import { AppointmentBlock } from "@/components/schedule/appointment-block"
import {
  blockLayout,
  getScheduleBoardRangeMinutes,
  scheduleBoardSlotHeightPx,
  staffInitials,
} from "@/lib/schedule/schedule-day-board"
import type { ScheduleStaffColumn } from "@/lib/schedule/schedule-day-types"
import type { AppointmentStatus } from "@/types/domain"

type StaffScheduleColumnProps = {
  column: ScheduleStaffColumn
  gridHeightPx: number
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
  visitCountLabel: (count: number) => string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onRequestCancel: (id: string) => void
  onDismissCancel: () => void
  onConfirmCancel: (entryId: string) => void
}

export function StaffScheduleColumn({
  column,
  gridHeightPx,
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
  visitCountLabel,
  onChangeStatus,
  onRequestCancel,
  onDismissCancel,
  onConfirmCancel,
}: StaffScheduleColumnProps) {
  const range = getScheduleBoardRangeMinutes()
  const slotHeightPx = scheduleBoardSlotHeightPx()

  return (
    <div className="flex min-w-[10.5rem] flex-1 flex-col overflow-hidden border-r border-border/60 last:border-r-0">
      <div className="flex h-[3.25rem] shrink-0 items-center gap-2 border-b border-border/60 bg-muted/15 px-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
          aria-hidden
        >
          {staffInitials(column.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{column.name}</p>
          <p className="truncate text-xs text-muted-foreground">{visitCountLabel(column.entries.length)}</p>
        </div>
      </div>

      <div
        className="relative min-w-0 flex-1 overflow-hidden"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${slotHeightPx}px - 1px), hsl(var(--border) / 0.4) calc(${slotHeightPx}px - 1px), hsl(var(--border) / 0.4) ${slotHeightPx}px)`,
          backgroundSize: `100% ${slotHeightPx}px`,
        }}
      >
        <div className="relative min-w-0" style={{ height: gridHeightPx }}>
          {column.entries.map((entry, index) => {
            const layout = blockLayout(entry, range)
            return (
              <AppointmentBlock
                key={entry.id}
                entry={entry}
                topPct={layout.topPct}
                heightPx={layout.heightPx}
                clipped={layout.clipped}
                stackIndex={index}
                statusMenuOrder={statusMenuOrder}
                isConfirmingCancel={confirmCancelForId === entry.id}
                isCancelling={cancellingId === entry.id}
                statusLabel={statusLabel}
                changeStatusLabel={changeStatusLabel}
                cancelLabel={cancelLabel}
                cancelConfirmMessage={cancelConfirmMessage}
                cancelConfirmBack={cancelConfirmBack}
                cancelConfirmAction={cancelConfirmAction}
                loadingLabel={loadingLabel}
                onChangeStatus={onChangeStatus}
                onRequestCancel={onRequestCancel}
                onDismissCancel={onDismissCancel}
                onConfirmCancel={() => onConfirmCancel(entry.id)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function scheduleGridHeightPx(): number {
  const { span } = getScheduleBoardRangeMinutes()
  return Math.round(span * (scheduleBoardSlotHeightPx() / 30))
}
