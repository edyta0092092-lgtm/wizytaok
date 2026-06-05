"use client"

import { CalendarClock, Globe, User, Wrench } from "lucide-react"

import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions"
import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { StatusBadge } from "@/components/shared/status-badge"
import { appointmentStatusStripeClass } from "@/lib/appointments/appointment-status-visual"
import {
  appointmentSourceLabel,
  appointmentSourceTone,
} from "@/lib/appointments/appointments-source-filter"
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
}: AppointmentListCardProps) {
  const { t } = useTranslations()
  const staffName = inferBookingStaffDisplayName(
    row.staffId,
    row.staffName,
    row.serviceId ? staffByService[row.serviceId] : undefined,
  )
  const sourceLabel = appointmentSourceLabel(row.source, t)
  const sourceTone = appointmentSourceTone(row.source)

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
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={row.status}
                  needsAction={appointmentShowsNeedsActionStatus(row)}
                />
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium",
                    sourceTone === "online"
                      ? "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                >
                  {row.source === "online" ? (
                    <Globe className="mr-1 size-3" aria-hidden />
                  ) : (
                    <Wrench className="mr-1 size-3" aria-hidden />
                  )}
                  {sourceLabel}
                </span>
              </div>
              <p className="text-base font-semibold leading-tight text-foreground">{row.clientName}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-foreground">{timeLabel}</p>
              <p className="text-muted-foreground">{dateLabel}</p>
            </div>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
              <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <dt className="sr-only">{t("appointments.serviceFilterLabel")}</dt>
                <dd className="font-medium text-foreground">{row.serviceLabel}</dd>
              </div>
            </div>
            <div className="flex min-w-0 items-start gap-2 text-muted-foreground">
              <User className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0">
                <dt className="sr-only">{t("appointments.staffFilterLabel")}</dt>
                <dd>
                  <AppointmentStaffCaption
                    appointment={row}
                    className="text-sm text-foreground"
                    resolvedDisplayName={staffName}
                  />
                </dd>
              </div>
            </div>
          </dl>

          {showNeedsActionReason ? (
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/95">
              {getBookingActionReason(row, language)}
            </p>
          ) : null}

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

          {quickCancelConfirmOpen ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-foreground">
                {t("appointments.cancelVisitConfirmMessage")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium"
                  onClick={onQuickCancelDismiss}
                  disabled={isCancellingVisit}
                >
                  {t("appointments.cancelVisitConfirmBack")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground"
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
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm"
                  onClick={onDeleteConfirmDismiss}
                  disabled={isDeletingAppointment}
                >
                  {t("appointments.deleteConfirmCancel")}
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center rounded-xl bg-destructive px-4 text-sm font-medium text-destructive-foreground"
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

          {detailsSlot ? (
            <div className="border-t border-border/60 pt-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden />
                {t("appointments.cardDetailsLabel")}
              </div>
              {detailsSlot}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
