"use client"

import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { AppointmentStatus } from "@/types/domain"

function normalizeStatus(status: AppointmentStatus | "scheduled"): AppointmentStatus {
  if (status === "scheduled" || status === "booked" || status === "pending") return "confirmed"
  return status
}

const statusTone: Record<
  AppointmentStatus,
  "success" | "warning" | "info" | "danger" | "neutral"
> = {
  booked: "success",
  pending: "success",
  confirmed: "success",
  cancelled: "neutral",
  completed: "neutral",
  no_show: "warning",
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
    <span className={semanticStatusBadgeClass(statusTone[key], className)} title={description}>
      {label}
    </span>
  )
}
