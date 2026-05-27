"use client"

import * as React from "react"
import { CalendarDays, Info, X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { DayScheduleBoard } from "@/components/schedule/day-schedule-board"
import { DayScheduleMobileList } from "@/components/schedule/day-schedule-mobile-list"
import { Button } from "@/components/ui/button"
import { buildStaffColumns } from "@/lib/schedule/schedule-day-board"
import { isScheduleDropdownMenuTarget } from "@/lib/schedule/schedule-dialog-dropdown"
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
  cancellingId: string | null
  statusMenuOrder: AppointmentStatus[]
  visitCountLabel: (count: number) => string
  statusLabel: (status: AppointmentStatus) => string
  changeStatusLabel: string
  cancelLabel: string
  staffFallbackLabel: string
  emptyLabel: string
  actionNotice?: string
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  onCancelVisit: (id: string) => void
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
  cancellingId,
  statusMenuOrder,
  visitCountLabel,
  statusLabel,
  changeStatusLabel,
  cancelLabel,
  staffFallbackLabel,
  emptyLabel,
  actionNotice,
  onChangeStatus,
  onCancelVisit,
}: DayScheduleModalProps) {
  const isNarrowViewport = useIsNarrowViewport()
  const timezone = useDisplayTimezone()
  const columns = buildStaffColumns(entries, staffMembers, staffNameById)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[min(94vh,56rem)] w-[min(98vw,72rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/80 bg-background text-foreground shadow-2xl",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
          onPointerDownOutside={(event) => {
            if (isScheduleDropdownMenuTarget(event.target)) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (isScheduleDropdownMenuTarget(event.target)) event.preventDefault()
          }}
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-border/70 px-6 py-4 pr-14">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CalendarDays className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-heading text-xl font-bold capitalize tracking-tight text-foreground">
                {dayTitle}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {visitSummary}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="absolute top-4 right-4 size-9 rounded-lg"
                aria-label="Zamknij"
              >
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </header>

          {actionNotice ? (
            <p className="mx-6 mt-3 shrink-0 rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm text-foreground">
              {actionNotice}
            </p>
          ) : null}

          <div className="flex min-h-[min(52vh,34rem)] min-w-0 flex-1 flex-col overflow-hidden">
            {entries.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            ) : isNarrowViewport ? (
              <DayScheduleMobileList
                entries={entries}
                cancellingId={cancellingId}
                statusMenuOrder={statusMenuOrder}
                statusLabel={statusLabel}
                changeStatusLabel={changeStatusLabel}
                cancelLabel={cancelLabel}
                staffFallbackLabel={staffFallbackLabel}
                onChangeStatus={onChangeStatus}
                onCancelVisit={onCancelVisit}
              />
            ) : (
              <DayScheduleBoard
                columns={columns}
                visitCountLabel={visitCountLabel}
                cancellingId={cancellingId}
                statusMenuOrder={statusMenuOrder}
                statusLabel={statusLabel}
                changeStatusLabel={changeStatusLabel}
                cancelLabel={cancelLabel}
                staffFallbackLabel={staffFallbackLabel}
                onChangeStatus={onChangeStatus}
                onCancelVisit={onCancelVisit}
              />
            )}
          </div>

          {!isNarrowViewport && entries.length > 0 ? (
            <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-border/70 bg-[#f8faf9] px-6 py-3.5 dark:bg-muted/15">
              <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0" aria-hidden />
                <span>Godziny są wyświetlane w strefie: {timezone}</span>
              </p>
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="outline" size="default" className="min-w-[6.5rem] rounded-lg">
                  Zamknij
                </Button>
              </DialogPrimitive.Close>
            </footer>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
