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
  "flex w-full min-w-0 flex-wrap items-center justify-end gap-2 overflow-visible"

const outlineActionClassName =
  "h-9 w-auto shrink-0 select-none justify-center rounded-xl whitespace-nowrap active:bg-muted active:text-foreground"

const deleteActionClassName =
  "h-9 w-auto shrink-0 select-none justify-center gap-1.5 rounded-xl whitespace-nowrap text-muted-foreground hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10 active:text-destructive [&_svg]:size-3.5"

export type AppointmentRowActionsProps = {
  status: AppointmentStatus
  statusOrder: readonly AppointmentStatus[]
  onEditVisit: () => void
  onChangeStatus: (status: AppointmentStatus) => void
  onDelete: () => void
  /** Gdy false, ukryj trwałe usunięcie wizyty (np. dla personelu bez prawa delete). */
  allowAppointmentDelete?: boolean
}

export function AppointmentRowActions({
  status,
  statusOrder,
  onEditVisit,
  onChangeStatus,
  onDelete,
  allowAppointmentDelete = true,
}: AppointmentRowActionsProps) {
  const { t } = useTranslations()
  const visitLocked = isAppointmentVisitLocked(status)

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
      {allowAppointmentDelete ? (
        <Button type="button" variant="ghost" size="default" className={deleteActionClassName} onClick={onDelete}>
          <Trash2 className="shrink-0" aria-hidden />
          {t("common.delete")}
        </Button>
      ) : null}
    </div>
  )
}
