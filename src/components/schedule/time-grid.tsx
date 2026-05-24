"use client"

import { buildHalfHourSlotLabels, scheduleBoardSlotHeightPx } from "@/lib/schedule/schedule-day-board"
import { SCHEDULE_BOARD_DAY_START_HOUR } from "@/lib/schedule/schedule-day-types"

type TimeGridProps = {
  gridHeightPx: number
}

export function TimeGrid({ gridHeightPx }: TimeGridProps) {
  const labels = buildHalfHourSlotLabels()
  const slotHeightPx = scheduleBoardSlotHeightPx()
  const rangeStartMin = SCHEDULE_BOARD_DAY_START_HOUR * 60

  return (
    <div
      className="relative w-[4.25rem] shrink-0 overflow-hidden border-r border-border/60 bg-background"
      style={{ height: gridHeightPx }}
    >
      {labels.map((label) => {
        const [h, m] = label.split(":").map(Number)
        const topPx = (h * 60 + m - rangeStartMin) * (slotHeightPx / 30)
        return (
          <span
            key={label}
            className="pointer-events-none absolute left-0 right-0 z-0 px-2 text-[11px] font-medium leading-none tabular-nums text-muted-foreground"
            style={{ top: topPx }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}

export function TimeGridHeaderCell() {
  return (
    <div className="flex h-[3.25rem] w-[4.25rem] shrink-0 items-end border-b border-r border-border/60 bg-muted/15 px-2 pb-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Godzina</span>
    </div>
  )
}
