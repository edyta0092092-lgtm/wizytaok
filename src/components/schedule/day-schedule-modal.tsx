"use client"

import { X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { DayScheduleMobileList } from "@/components/schedule/day-schedule-mobile-list"
import { scheduleGridHeightPx, StaffScheduleColumn } from "@/components/schedule/staff-schedule-column"
import { TimeGrid } from "@/components/schedule/time-grid"
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
  const columns = buildStaffColumns(entries, staffMembers, staffNameById)
  const gridHeightPx = scheduleGridHeightPx()
  const entryById = new Map(entries.map((e) => [e.id, e]))

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className={cn(
            "premium-scrollbar fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,52rem)] w-[min(90vw,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border/70 bg-background text-foreground shadow-2xl",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-3 pr-12">
            <div>
              <DialogPrimitive.Title className="font-heading text-lg font-semibold capitalize">
                {dayTitle}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 text-sm text-muted-foreground">
                {visitSummary}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon-sm" className="absolute top-3 right-3 rounded-full" aria-label="Zamknij">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {entries.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <>
                <div className="md:hidden">
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
                </div>

                <div className="hidden min-h-0 flex-1 flex-col md:flex">
                  <div className="premium-scrollbar min-h-0 flex-1 overflow-auto">
                    <div className="flex min-w-max">
                      <div className="sticky left-0 z-30 flex flex-col bg-background">
                        <div className="h-[3.25rem] shrink-0 border-b border-r border-border/60 bg-muted/20" />
                        <TimeGrid gridHeightPx={gridHeightPx} />
                      </div>
                      <div className="flex flex-1">
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
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
