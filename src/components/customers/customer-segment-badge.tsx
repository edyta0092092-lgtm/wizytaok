"use client"

import type { CustomerSegment } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

const segmentClass: Record<CustomerSegment, string> = {
  new: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100",
  returning:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  loyal:
    "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
  lost: "border-border bg-muted/60 text-muted-foreground",
}

export function CustomerSegmentBadge({
  segment,
  className,
}: {
  segment: CustomerSegment
  className?: string
}) {
  const { t } = useTranslations()
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        segmentClass[segment],
        className,
      )}
    >
      {t(`customers.segment.${segment}`)}
    </span>
  )
}
