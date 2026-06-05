"use client"

import { appointmentStatusTone } from "@/lib/appointments/appointment-status-visual"
import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { AppointmentStatus } from "@/types/domain"

function normalizeStatus(status: AppointmentStatus | "scheduled"): AppointmentStatus {
  if (status === "scheduled" || status === "booked" || status === "pending") return "confirmed"
  return status
}

type StatusBadgeProps = {
  status: AppointmentStatus | "scheduled"
  /** Gdy wizyta wymaga reakcji firmy — badge zastępuje status bazowy (np. Potwierdzona). */
  needsAction?: boolean
  className?: string
}

export function StatusBadge({ status, needsAction, className }: StatusBadgeProps) {
  const { t } = useTranslations()
  if (needsAction) {
    return (
      <span className={semanticStatusBadgeClass("warning", className)}>
        {t("labels.appointmentStatus.needs_action")}
      </span>
    )
  }
  const key = normalizeStatus(status)
  const label = t(`labels.appointmentStatus.${key}` as "labels.appointmentStatus.booked")
  const description =
    key === "no_show"
      ? t("labels.appointmentStatusDescription.no_show")
      : undefined
  return (
    <span className={semanticStatusBadgeClass(appointmentStatusTone(key), className)} title={description}>
      {label}
    </span>
  )
}
