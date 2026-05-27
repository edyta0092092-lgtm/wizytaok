"use client"

import { formatHm } from "@/lib/schedule/schedule-day-board"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"

type ScheduleVisitCardDetailsProps = {
  entry: Pick<
    ScheduleDayEntry,
    "appointment_time" | "client_name" | "service_name" | "staff_name"
  >
  staffFallback: string
  compact?: boolean
  className?: string
}

export function ScheduleVisitCardDetails({
  entry,
  staffFallback,
  compact = false,
  className,
}: ScheduleVisitCardDetailsProps) {
  const staff = entry.staff_name?.trim() || staffFallback
  const time = formatHm(entry.appointment_time)
  const textSize = compact ? "text-[10px] leading-3.5" : "text-xs leading-4"

  return (
    <div className={cn("flex min-w-0 flex-1 gap-2", className)}>
      <p
        className={cn(
          "w-9 shrink-0 font-semibold tabular-nums text-foreground",
          compact ? "text-[10px] leading-3.5" : "text-xs leading-4",
        )}
        title={time}
      >
        {time}
      </p>
      <div className={cn("min-w-0 flex-1 overflow-hidden", textSize)}>
        <p className="truncate font-semibold text-foreground" title={entry.client_name}>
          {entry.client_name}
        </p>
        <p className="truncate text-muted-foreground" title={entry.service_name}>
          {entry.service_name}
        </p>
        <p className="truncate text-muted-foreground" title={staff}>
          {staff}
        </p>
      </div>
    </div>
  )
}
