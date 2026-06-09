"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isAppointmentVisitLocked } from "@/lib/appointments/appointment-visit-lock"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { AppointmentStatus } from "@/types/domain"

const actionBarClassName =
  "flex w-full min-w-0 flex-wrap items-stretch gap-2 sm:items-center sm:justify-end"

const outlineActionClassName =
  "h-11 min-h-11 w-full shrink-0 touch-manipulation select-none justify-center rounded-xl whitespace-nowrap active:bg-muted active:text-foreground sm:h-9 sm:min-h-9 sm:w-auto"

const cancelActionClassName =
  "h-11 min-h-11 w-full shrink-0 touch-manipulation select-none justify-center rounded-xl whitespace-nowrap border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:min-h-9 sm:w-auto"

const deleteActionClassName =
  "h-11 min-h-11 w-full shrink-0 touch-manipulation select-none justify-center gap-1.5 rounded-xl whitespace-nowrap text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive sm:h-9 sm:min-h-9 sm:w-auto [&_svg]:size-3.5"

export type AppointmentRowActionsProps = {
  status: AppointmentStatus
  statusOrder: readonly AppointmentStatus[]
  onEditVisit: () => void
  onChangeStatus: (status: AppointmentStatus) => void
  onQuickCancelPress?: () => void
  quickCancelConfirmOpen?: boolean
  isCancellingVisit?: boolean
  onDelete: () => void
  allowAppointmentDelete?: boolean
}

export function AppointmentRowActions({
  status,
  statusOrder,
  onEditVisit,
  onChangeStatus,
  onQuickCancelPress,
  quickCancelConfirmOpen = false,
  isCancellingVisit = false,
  onDelete,
  allowAppointmentDelete = true,
}: AppointmentRowActionsProps) {
  const { t } = useTranslations()
  const visitLocked = isAppointmentVisitLocked(status)
  const canQuickCancel =
    !visitLocked && status !== "cancelled" && typeof onQuickCancelPress === "function"

  return (
    <div className={actionBarClassName}>
      {!visitLocked ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          className={outlineActionClassName}
          onClick={onEditVisit}
        >
          {t("appointments.editVisit")}
        </Button>
      ) : null}
      {!visitLocked ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="default" className={outlineActionClassName}>
              {t("appointments.changeStatusAction")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {statusOrder
              .filter((s) => s !== status)
              .map((s) => (
                <DropdownMenuItem key={s} onClick={() => onChangeStatus(s)}>
                  {t(`labels.appointmentStatus.${s}` as "labels.appointmentStatus.booked")}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {canQuickCancel && !quickCancelConfirmOpen ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          className={cancelActionClassName}
          onClick={onQuickCancelPress}
          disabled={isCancellingVisit}
        >
          {t("appointments.cancelVisit")}
        </Button>
      ) : null}
      {allowAppointmentDelete ? (
        <Button type="button" variant="ghost" size="default" className={deleteActionClassName} onClick={onDelete}>
          <Trash2 className="shrink-0" aria-hidden />
          {t("common.delete")}
        </Button>
      ) : null}
    </div>
  )
}
