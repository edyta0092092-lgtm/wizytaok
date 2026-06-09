"use client"

import { CalendarClock } from "lucide-react"

import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions"
import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { StatusBadge } from "@/components/shared/status-badge"
import { appointmentStatusStripeClass } from "@/lib/appointments/appointment-status-visual"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { getBookingActionReason } from "@/lib/bookings/booking-needs-action"
import { inferBookingStaffDisplayName } from "@/lib/staff/staff-display"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

export type AppointmentListCardProps = {
  row: Appointment
  dateLabel: string
  timeLabel: string
  showNeedsActionReason: boolean
  language: "pl" | "en"
  staffByService: Record<string, StaffMember[]>
  statusOrder: readonly AppointmentStatus[]
  allowAppointmentDelete: boolean
  onChangeStatus: (status: AppointmentStatus) => void
  onEditVisit: () => void
  onQuickCancelPress: () => void
  quickCancelConfirmOpen: boolean
  onQuickCancelDismiss: () => void
  onQuickCancelConfirm: () => void
  isCancellingVisit: boolean
  onDeleteRequest: () => void
  showDeleteConfirm: boolean
  onDeleteConfirmDismiss: () => void
  onDeleteConfirm: () => void
  isDeletingAppointment: boolean
  detailsSlot?: React.ReactNode
  footerSlot?: React.ReactNode
}

export function AppointmentListCard({
  row,
  dateLabel,
  timeLabel,
  showNeedsActionReason,
  language,
  staffByService,
  statusOrder,
  allowAppointmentDelete,
  onChangeStatus,
  onEditVisit,
  onQuickCancelPress,
  quickCancelConfirmOpen,
  onQuickCancelDismiss,
  onQuickCancelConfirm,
  isCancellingVisit,
  onDeleteRequest,
  showDeleteConfirm,
  onDeleteConfirmDismiss,
  onDeleteConfirm,
  isDeletingAppointment,
  detailsSlot,
  footerSlot,
}: AppointmentListCardProps) {
  const { t } = useTranslations()
  const staffName = inferBookingStaffDisplayName(
    row.staffId,
    row.staffName,
    row.serviceId ? staffByService[row.serviceId] : undefined,
  )
  return (
    <article className="p-4">
      <div className="flex gap-3">
        <div
          className={cn(
            "hidden w-1 shrink-0 self-stretch rounded-full sm:block",
            appointmentStatusStripeClass(row.status),
          )}
          aria-hidden
        />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-base font-semibold leading-tight text-foreground">{row.clientName}</p>
              <p className="text-sm font-medium text-foreground">{row.serviceLabel}</p>
              <AppointmentStaffCaption
                appointment={row}
                className="text-sm text-muted-foreground"
                resolvedDisplayName={staffName}
              />
            </div>
            <div className="flex shrink-0 flex-col items-end text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">{timeLabel}</p>
              <p className="text-xs text-muted-foreground">{dateLabel}</p>
            </div>
          </div>

          {showNeedsActionReason ? (
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/95">
              {getBookingActionReason(row, language)}
            </p>
          ) : null}

          <div className="space-y-3 border-t border-border/60 pt-3">
            <div className="flex justify-end">
              <StatusBadge
                status={row.status}
                needsAction={appointmentShowsNeedsActionStatus(row)}
              />
            </div>

            {detailsSlot ? (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {t("appointments.cardDetailsLabel")}
                </div>
                {detailsSlot}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "flex flex-col gap-3 border-t border-border/60 pt-3 sm:flex-row sm:items-end",
              footerSlot ? "sm:justify-between" : "sm:justify-end",
            )}
          >
            {footerSlot ? <div className="flex shrink-0 justify-start">{footerSlot}</div> : null}
            <div className={cn("min-w-0", footerSlot && "sm:flex-1 sm:flex sm:justify-end")}>
              <AppointmentRowActions
                status={row.status}
                statusOrder={statusOrder}
                onEditVisit={onEditVisit}
                onChangeStatus={onChangeStatus}
                onQuickCancelPress={onQuickCancelPress}
                quickCancelConfirmOpen={quickCancelConfirmOpen}
                isCancellingVisit={isCancellingVisit}
                allowAppointmentDelete={allowAppointmentDelete}
                onDelete={onDeleteRequest}
              />
            </div>
          </div>

          {quickCancelConfirmOpen ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-foreground">
                {t("appointments.cancelVisitConfirmMessage")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-11 touch-manipulation items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium sm:h-9"
                  onClick={onQuickCancelDismiss}
                  disabled={isCancellingVisit}
                >
                  {t("appointments.cancelVisitConfirmBack")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 touch-manipulation items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground sm:h-9"
                  onClick={onQuickCancelConfirm}
                  disabled={isCancellingVisit}
                >
                  {isCancellingVisit
                    ? t("appointments.cancellingVisit")
                    : t("appointments.cancelVisitConfirmAction")}
                </button>
              </div>
            </div>
          ) : null}

          {showDeleteConfirm ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-semibold text-foreground">
                {t("appointments.deleteConfirmTitle")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("appointments.deleteConfirmDescription")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-11 touch-manipulation items-center justify-center rounded-xl border border-border bg-background px-4 text-sm sm:h-9"
                  onClick={onDeleteConfirmDismiss}
                  disabled={isDeletingAppointment}
                >
                  {t("appointments.deleteConfirmCancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 touch-manipulation items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground sm:h-9"
                  onClick={onDeleteConfirm}
                  disabled={isDeletingAppointment}
                >
                  {isDeletingAppointment
                    ? t("appointments.deleteConfirmActionLoading")
                    : t("appointments.deleteConfirmAction")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
