"use client"

import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment, AppointmentStatus } from "@/types/domain"

const actionBarClassName =
  "flex w-full min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-2"

const outlineActionClassName =
  "min-h-9 w-full justify-center rounded-xl md:h-9 md:w-auto md:min-w-0 md:shrink-0"

const deleteActionClassName =
  "min-h-9 w-full justify-center gap-1.5 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive md:h-9 md:w-auto md:min-w-0 md:shrink-0 [&_svg]:size-3.5"

export type AppointmentRowActionsProps = {
  row: Appointment
  statusOrder: readonly AppointmentStatus[]
  onEditVisit: () => void
  onChangeStatus: (status: AppointmentStatus) => void
  onDelete: () => void
  /** Gdy false, ukryj trwałe usunięcie wizyty (np. dla personelu bez prawa delete). */
  allowAppointmentDelete?: boolean
}

export function AppointmentRowActions({
  row,
  statusOrder,
  onEditVisit,
  onChangeStatus,
  onDelete,
  allowAppointmentDelete = true,
}: AppointmentRowActionsProps) {
  const { t } = useTranslations()

  if (row.status === "cancelled") {
    return (
      <div className={actionBarClassName}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="default" className={outlineActionClassName}>
              {t("appointments.moreActions")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {allowAppointmentDelete ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  queueMicrotask(() => onDelete())
                }}
              >
                {t("common.delete")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className={actionBarClassName}>
      <Button
        type="button"
        variant="outline"
        size="default"
        className={outlineActionClassName}
        onClick={onEditVisit}
      >
        {t("appointments.editVisit")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="default" className={outlineActionClassName}>
            {t("appointments.changeStatusAction")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {statusOrder.map((s) => (
            <DropdownMenuItem key={s} onClick={() => onChangeStatus(s)}>
              {t(`labels.appointmentStatus.${s}` as "labels.appointmentStatus.booked")}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {allowAppointmentDelete ? (
        <Button type="button" variant="ghost" size="default" className={deleteActionClassName} onClick={onDelete}>
          <Trash2 className="shrink-0" aria-hidden />
          {t("common.delete")}
        </Button>
      ) : null}
    </div>
  )
}
