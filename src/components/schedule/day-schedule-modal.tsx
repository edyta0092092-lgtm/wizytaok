"use client"

import * as React from "react"
import { CalendarDays, Info, X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { DayScheduleMobileList } from "@/components/schedule/day-schedule-mobile-list"
import { scheduleGridHeightPx, StaffScheduleColumn } from "@/components/schedule/staff-schedule-column"
import { TimeGrid, TimeGridHeaderCell } from "@/components/schedule/time-grid"
import { Button } from "@/components/ui/button"
import { buildStaffColumns } from "@/lib/schedule/schedule-day-board"
import type { ScheduleDayEntry } from "@/lib/schedule/schedule-day-types"
import { cn } from "@/lib/utils"
import type { AppointmentStatus, StaffMember } from "@/types/domain"

type DayScheduleModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  dayTitle: string
  visitSummary: string
  entries: ScheduleDayEntry[]
  staffMembers: StaffMember[]
  staffNameById: Map<string, string>
  confirmCancelForId: string | null
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  visitCountLabel: (count: number) => string
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  cancelConfirmMessage: string
  cancelConfirmBack: string
  cancelConfirmAction: string
  loadingLabel: string
  emptyLabel: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onRequestCancel: (id: string) => void
  onDismissCancel: () => void
  onConfirmCancel: (entry: ScheduleDayEntry) => void
}

const NARROW_VIEWPORT_QUERY = "(max-width: 639px)"

function subscribeNarrowViewport(onStoreChange: () => void) {
  const media = window.matchMedia(NARROW_VIEWPORT_QUERY)
  media.addEventListener("change", onStoreChange)
  return () => media.removeEventListener("change", onStoreChange)
}

function getNarrowViewportSnapshot() {
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches
}

function useIsNarrowViewport() {
  return React.useSyncExternalStore(
    subscribeNarrowViewport,
    getNarrowViewportSnapshot,
    () => false,
  )
}

function useDisplayTimezone() {
  return React.useSyncExternalStore(
    () => () => {},
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "Europe/Warsaw",
  )
}

export function DayScheduleModal({
  open,
  onOpenChange,
  dayTitle,
  visitSummary,
  entries,
  staffMembers,
  staffNameById,
  confirmCancelForId,
  cancellingId,
  statusMenuOrder,
  visitCountLabel,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  cancelConfirmMessage,
  cancelConfirmBack,
  cancelConfirmAction,
  loadingLabel,
  emptyLabel,
  onChangeStatus,
  onRequestCancel,
  onDismissCancel,
  onConfirmCancel,
}: DayScheduleModalProps) {
  const isNarrowViewport = useIsNarrowViewport()
  const timezone = useDisplayTimezone()
  const columns = buildStaffColumns(entries, staffMembers, staffNameById)
  const gridHeightPx = scheduleGridHeightPx()
  const entryById = new Map(entries.map((e) => [e.id, e]))

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            "premium-scrollbar fixed top-1/2 left-1/2 z-50 flex max-h-[min(92vh,54rem)] w-[min(96vw,calc(100vw-1rem))] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background text-foreground shadow-2xl sm:max-w-6xl",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <div className="flex shrink-0 items-start gap-3 border-b border-border/60 px-5 py-4 pr-14">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-heading text-lg font-bold capitalize text-foreground">
                {dayTitle}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {visitSummary}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-3.5 right-3.5 rounded-full"
                aria-label="Zamknij"
              >
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {entries.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            ) : isNarrowViewport ? (
              <DayScheduleMobileList
                entries={entries}
                confirmCancelForId={confirmCancelForId}
                cancellingId={cancellingId}
                statusMenuOrder={statusMenuOrder}
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
                onConfirmCancel={(id) => {
                  const entry = entryById.get(id)
                  if (entry) onConfirmCancel(entry)
                }}
              />
            ) : (
              <div className="flex min-h-[min(56vh,36rem)] flex-1 flex-col">
                <div className="premium-scrollbar min-h-0 flex-1 overflow-auto">
                  <div className="flex min-w-max">
                    <div className="sticky left-0 z-30 flex flex-col bg-background">
                      <TimeGridHeaderCell />
                      <TimeGrid gridHeightPx={gridHeightPx} />
                    </div>
                    <div className="flex min-w-0 flex-1">
                      {columns.map((column) => (
                        <StaffScheduleColumn
                          key={column.id}
                          column={column}
                          gridHeightPx={gridHeightPx}
                          confirmCancelForId={confirmCancelForId}
                          cancellingId={cancellingId}
                          statusMenuOrder={statusMenuOrder}
                          statusLabel={statusLabel}
                          changeStatusLabel={changeStatusLabel}
                          cancelLabel={cancelLabel}
                          cancelConfirmMessage={cancelConfirmMessage}
                          cancelConfirmBack={cancelConfirmBack}
                          cancelConfirmAction={cancelConfirmAction}
                          loadingLabel={loadingLabel}
                          visitCountLabel={visitCountLabel}
                          onChangeStatus={onChangeStatus}
                          onRequestCancel={onRequestCancel}
                          onDismissCancel={onDismissCancel}
                          onConfirmCancel={(id) => {
                            const entry = entryById.get(id)
                            if (entry) onConfirmCancel(entry)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!isNarrowViewport && entries.length > 0 ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-5 py-3">
              <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">Godziny są wyświetlane w strefie: {timezone}</span>
              </p>
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="outline" size="sm">
                  Zamknij
                </Button>
              </DialogPrimitive.Close>
            </div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
