"use client"

import { CheckCircle2, Phone, XCircle } from "lucide-react"

import { AppointmentsSwipeRow } from "@/components/appointments/appointments-swipe-row"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { isAppointmentVisitLocked } from "@/lib/appointments/appointment-visit-lock"
import { appointmentShowsNeedsActionStatus } from "@/lib/appointments/stats-rules"
import { inferBookingStaffDisplayName } from "@/lib/staff/staff-display"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

type AppointmentsMobileCardProps = {
  row: Appointment
  timeLabel: string
  dateLabel: string
  showDate?: boolean
  staffByService: Record<string, StaffMember[]>
  onChangeStatus: (status: AppointmentStatus) => void
  onCancelPress: () => void
  onEditVisit: () => void
  cancelConfirmOpen: boolean
  onCancelDismiss: () => void
  onCancelConfirm: () => void
  isCancellingVisit: boolean
}

function actionButtonClass(disabled?: boolean) {
  return cn(
    "h-11 min-h-11 flex-1 touch-manipulation rounded-xl px-2 text-xs font-semibold",
    disabled && "pointer-events-none opacity-40",
  )
}

export function AppointmentsMobileCard({
  row,
  timeLabel,
  dateLabel,
  showDate = false,
  staffByService,
  onChangeStatus,
  onCancelPress,
  onEditVisit,
  cancelConfirmOpen,
  onCancelDismiss,
  onCancelConfirm,
  isCancellingVisit,
}: AppointmentsMobileCardProps) {
  const { t } = useTranslations()
  const visitLocked = isAppointmentVisitLocked(row.status)
  const staffName =
    inferBookingStaffDisplayName(
      row.staffId,
      row.staffName,
      row.serviceId ? staffByService[row.serviceId] : undefined,
    ) || t("appointments.staffNotAssignedShort")
  const phone = row.phone?.trim() ?? ""
  const canConfirm = !visitLocked && (row.status === "booked" || row.status === "pending")
  const canComplete = !visitLocked && row.status !== "cancelled"
  const canCancel = !visitLocked && row.status !== "cancelled"

  return (
    <AppointmentsSwipeRow
      disabled={visitLocked || cancelConfirmOpen}
      rightActionLabel={t("appointments.quickConfirm")}
      leftActionLabel={t("appointments.quickCancel")}
      onSwipeRight={canConfirm ? () => onChangeStatus("confirmed") : undefined}
      onSwipeLeft={canCancel ? onCancelPress : undefined}
    >
      <article className="rounded-2xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums leading-none text-foreground">{timeLabel}</p>
            {showDate ? <p className="mt-1 text-xs text-muted-foreground">{dateLabel}</p> : null}
          </div>
          <StatusBadge
            status={row.status}
            needsAction={appointmentShowsNeedsActionStatus(row)}
          />
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-lg font-semibold leading-tight text-foreground">{row.clientName}</p>
          <p className="text-sm text-muted-foreground">{row.serviceLabel}</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{t("appointments.fieldStaff")}:</span>{" "}
            {staffName}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className={actionButtonClass(!canConfirm)}
            disabled={!canConfirm}
            onClick={() => onChangeStatus("confirmed")}
          >
            <CheckCircle2 className="mr-1.5 size-4 shrink-0" aria-hidden />
            {t("appointments.quickConfirm")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={actionButtonClass(!canComplete)}
            disabled={!canComplete}
            onClick={() => onChangeStatus("completed")}
          >
            {t("appointments.quickComplete")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(actionButtonClass(!canCancel), "border-destructive/30 text-destructive")}
            disabled={!canCancel || isCancellingVisit}
            onClick={onCancelPress}
          >
            <XCircle className="mr-1.5 size-4 shrink-0" aria-hidden />
            {t("appointments.quickCancel")}
          </Button>
          {phone ? (
            <Button type="button" variant="default" className={actionButtonClass()} asChild>
              <a href={`tel:${phone.replace(/\s/g, "")}`}>
                <Phone className="mr-1.5 size-4 shrink-0" aria-hidden />
                {t("appointments.quickCall")}
              </a>
            </Button>
          ) : (
            <Button type="button" variant="outline" className={actionButtonClass(true)} disabled>
              <Phone className="mr-1.5 size-4 shrink-0" aria-hidden />
              {t("appointments.quickCall")}
            </Button>
          )}
        </div>

        <button
          type="button"
          className="mt-3 min-h-10 w-full touch-manipulation text-left text-xs font-medium text-primary"
          onClick={onEditVisit}
        >
          {t("appointments.editVisit")}
        </button>

        {cancelConfirmOpen ? (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-foreground">
              {t("appointments.cancelVisitConfirmMessage")}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-11 touch-manipulation rounded-xl"
                onClick={onCancelDismiss}
                disabled={isCancellingVisit}
              >
                {t("appointments.cancelVisitConfirmBack")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 touch-manipulation rounded-xl"
                onClick={onCancelConfirm}
                disabled={isCancellingVisit}
              >
                {isCancellingVisit
                  ? t("appointments.cancellingVisit")
                  : t("appointments.cancelVisitConfirmAction")}
              </Button>
            </div>
          </div>
        ) : null}
      </article>
    </AppointmentsSwipeRow>
  )
}
