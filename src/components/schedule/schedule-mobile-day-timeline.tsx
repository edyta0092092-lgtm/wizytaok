"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { DayScheduleAppointmentCard } from "@/components/schedule/day-schedule-appointment-card"
import { Button } from "@/components/ui/button"
import {
  buildHourSlotLabels,
  getScheduleBoardRangeMinutes,
  layoutColumnBlocks,
  scheduleBoardPxPerMinuteForZoom,
} from "@/lib/schedule/schedule-day-board"
import {
  SCHEDULE_BOARD_TIME_COLUMN_WIDTH_PX,
} from "@/lib/schedule/schedule-day-types"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/types/domain"

const MIN_ZOOM = 0.7
const MAX_ZOOM = 2.4

function touchDistance(touches: { length: number; [index: number]: { clientX: number; clientY: number } | undefined }): number {
  if (touches.length < 2) return 0
  const a = touches[0]
  const b = touches[1]
  if (!a || !b) return 0
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

type ScheduleMobileDayTimelineProps = {
  entries: ScheduleDayEntry[]
  isToday: boolean
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  staffFallbackLabel: string
  emptyLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
}

export function ScheduleMobileDayTimeline({
  entries,
  isToday,
  cancellingId,
  statusMenuOrder,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  staffFallbackLabel,
  emptyLabel,
  onChangeStatus,
  onCancelVisit,
}: ScheduleMobileDayTimelineProps) {
  const { t } = useTranslations()
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const [zoom, setZoom] = React.useState(1)
  const [isPinching, setIsPinching] = React.useState(false)
  const pinchRef = React.useRef<{ startDistance: number; startZoom: number } | null>(null)

  const range = getScheduleBoardRangeMinutes()
  const pxPerMinute = scheduleBoardPxPerMinuteForZoom(zoom)
  const gridHeightPx = Math.round(range.span * pxPerMinute)
  const hourLabels = React.useMemo(() => buildHourSlotLabels(), [])
  const hourHeightPx = 60 * pxPerMinute

  const blockLayouts = React.useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.appointment_time.localeCompare(b.appointment_time))
    return layoutColumnBlocks(sorted, range)
  }, [entries, range])

  const nowTopPx = React.useMemo(() => {
    if (!isToday) return null
    const now = new Date()
    const minutes = now.getHours() * 60 + now.getMinutes()
    if (minutes < range.start || minutes > range.end) return null
    return (minutes - range.start) * pxPerMinute
  }, [isToday, pxPerMinute, range.end, range.start])

  const scrollToNow = React.useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current
      if (!el || nowTopPx == null) return
      const target = Math.max(0, nowTopPx - el.clientHeight * 0.25)
      el.scrollTo({ top: target, behavior })
    },
    [nowTopPx],
  )

  React.useEffect(() => {
    if (!isToday) return
    const tid = window.setTimeout(() => scrollToNow("auto"), 80)
    return () => window.clearTimeout(tid)
  }, [isToday, entries.length, scrollToNow])

  const onTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      setIsPinching(true)
      pinchRef.current = {
        startDistance: touchDistance(event.touches),
        startZoom: zoom,
      }
    }
  }

  const onTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length !== 2 || !pinchRef.current) return
    event.preventDefault()
    const distance = touchDistance(event.touches)
    if (!distance || !pinchRef.current.startDistance) return
    const ratio = distance / pinchRef.current.startDistance
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchRef.current.startZoom * ratio))
    setZoom(next)
  }

  const onTouchEnd = () => {
    pinchRef.current = null
    setIsPinching(false)
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("schedule.mobilePinchHint")}</p>
        {isToday && nowTopPx != null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 shrink-0 touch-manipulation gap-1.5 rounded-xl px-3"
            onClick={() => scrollToNow("smooth")}
          >
            <Clock className="size-4" aria-hidden />
            {t("schedule.scrollToNow")}
          </Button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="premium-scrollbar relative min-h-[min(68vh,40rem)] flex-1 overflow-y-auto overflow-x-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5"
        style={{ touchAction: isPinching ? "none" : "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="flex min-w-0" style={{ minHeight: gridHeightPx }}>
          <div
            className="sticky left-0 z-30 shrink-0 border-r border-border/70 bg-background/95 backdrop-blur-sm"
            style={{ width: SCHEDULE_BOARD_TIME_COLUMN_WIDTH_PX }}
          >
            {hourLabels.map((label, index) => (
              <div
                key={label}
                className={cn(
                  "flex items-start border-b border-border/40 px-2 pt-1",
                  index === hourLabels.length - 1 && "border-b-0",
                )}
                style={{ height: index === hourLabels.length - 1 ? hourHeightPx / 2 : hourHeightPx }}
              >
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div
            className="relative min-w-0 flex-1 bg-background"
            style={{
              height: gridHeightPx,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${hourHeightPx}px - 1px), hsl(var(--border) / 0.45) calc(${hourHeightPx}px - 1px), hsl(var(--border) / 0.45) ${hourHeightPx}px)`,
              backgroundSize: `100% ${hourHeightPx}px`,
            }}
          >
            {nowTopPx != null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                style={{ top: nowTopPx }}
                aria-hidden
              >
                <span className="size-2.5 -translate-x-1/2 rounded-full bg-primary shadow-sm" />
                <span className="h-0.5 flex-1 bg-primary/80" />
              </div>
            ) : null}

            {entries.map((entry) => {
              const layout = blockLayouts.get(entry.id)
              if (!layout) return null
              const scaledTop = Math.round(layout.topPx * zoom)
              const scaledHeight = Math.max(52, Math.round(layout.heightPx * zoom))
              return (
                <DayScheduleAppointmentCard
                  key={entry.id}
                  entry={entry}
                  topPx={scaledTop}
                  heightPx={scaledHeight}
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
      </div>
    </div>
  )
}
