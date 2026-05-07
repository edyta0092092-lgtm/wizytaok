"use client"

import { User } from "lucide-react"

import { getBookingStaffCaptionLine } from "@/lib/staff/staff-display"
import type { StaffCaptionVariant } from "@/lib/staff/staff-display"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"
import { cn } from "@/lib/utils"

type Props = {
  appointment: Appointment
  className?: string
  /** `compact` - krócej, np. na dashboard. */
  variant?: StaffCaptionVariant
  /** Gdy w booking brak snapshotu nazwy (np. tylko `staff_id`) — rozwiązana z team services. */
  resolvedDisplayName?: string | null
}

export function AppointmentStaffCaption({
  appointment,
  className,
  variant = "full",
  resolvedDisplayName,
}: Props) {
  const { t } = useTranslations()
  const line = getBookingStaffCaptionLine(appointment, t, variant, resolvedDisplayName)

  return (
    <p
      className={cn(
        "flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground",
        variant === "full" && "text-[0.8125rem] leading-snug",
        className
      )}
    >
      <User className="mt-0.5 size-3 shrink-0 opacity-70" aria-hidden />
      <span className="min-w-0 break-words">{line}</span>
    </p>
  )
}
