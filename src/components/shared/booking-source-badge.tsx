"use client"

import { getBookingSourceLabel, getBookingSourceShortLabel, getBookingSourceTone } from "@/lib/bookings/booking-source"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type Props = {
  source: string | null | undefined
  variant?: "full" | "short"
  className?: string
}

export function BookingSourceBadge({ source, variant = "full", className }: Props) {
  const { language } = useTranslations()
  const tone = getBookingSourceTone(source)
  const text =
    variant === "short" ? getBookingSourceShortLabel(source, language) : getBookingSourceLabel(source, language)
  const title = variant === "short" ? getBookingSourceLabel(source, language) : undefined

  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-[10.5rem] shrink-0 truncate rounded-md border px-1.5 py-0 text-[10px] font-medium leading-tight",
        tone === "info"
          ? "border-sky-400/45 bg-sky-50/90 text-sky-950 dark:border-sky-500/35 dark:bg-sky-950/45 dark:text-sky-50"
          : "border-border/80 bg-muted/45 text-muted-foreground dark:border-muted-foreground/30 dark:bg-muted/25 dark:text-foreground/85",
        className
      )}
    >
      {text}
    </span>
  )
}
