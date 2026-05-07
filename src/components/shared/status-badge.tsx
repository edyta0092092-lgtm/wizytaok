"use client"

import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { AppointmentStatus } from "@/types/domain"

function normalizeStatus(status: AppointmentStatus | "scheduled"): AppointmentStatus {
  if (status === "scheduled") return "booked"
  return status
}

const statusTone: Record<
  AppointmentStatus,
  "success" | "warning" | "info" | "danger" | "neutral"
> = {
  booked: "info",
  pending: "warning",
  confirmed: "success",
  cancelled: "neutral",
  completed: "neutral",
  no_show: "warning",
}

type StatusBadgeProps = {
  status: AppointmentStatus | "scheduled"
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslations()
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
