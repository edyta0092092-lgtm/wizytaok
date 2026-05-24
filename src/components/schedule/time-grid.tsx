"use client"

import { buildHourLabels, getScheduleBoardRangeMinutes } from "@/lib/schedule/schedule-day-board"
import { SCHEDULE_BOARD_PX_PER_MINUTE } from "@/lib/schedule/schedule-day-types"

type TimeGridProps = {
  gridHeightPx: number
}

export function TimeGrid({ gridHeightPx }: TimeGridProps) {
  const labels = buildHourLabels()
  const { span } = getScheduleBoardRangeMinutes()
  const hourSpanMinutes = 60

  return (
    <div
      className="relative sticky left-0 z-20 w-14 shrink-0 border-r border-border/60 bg-background/95 backdrop-blur-sm"
      style={{ height: gridHeightPx }}
    >
      {labels.map((label, index) => {
        const topPx = index * hourSpanMinutes * SCHEDULE_BOARD_PX_PER_MINUTE
        if (topPx > span * SCHEDULE_BOARD_PX_PER_MINUTE) return null
        return (
          <span
            key={label}
            className="absolute right-2 -translate-y-1/2 text-[11px] font-medium tabular-nums text-muted-foreground"
            style={{ top: topPx }}
          >
            {label}
          </span>
        )
      })}
    </div>
  )
}
