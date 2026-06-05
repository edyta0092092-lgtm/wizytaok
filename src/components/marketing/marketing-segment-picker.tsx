"use client"

import { MARKETING_AUDIENCE_SEGMENTS } from "@/lib/marketing/marketing-audience"
import type { MarketingAudienceSegment } from "@/lib/marketing/marketing-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export function MarketingSegmentPicker({
  value,
  onChange,
  recipientCounts,
}: {
  value: MarketingAudienceSegment
  onChange: (segment: MarketingAudienceSegment) => void
  recipientCounts: Record<MarketingAudienceSegment, number>
}) {
  const { t } = useTranslations()

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {MARKETING_AUDIENCE_SEGMENTS.map((segment) => {
        const selected = value === segment
        return (
          <button
            key={segment}
            type="button"
            onClick={() => onChange(segment)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-muted/20",
            )}
          >
            <p className="text-sm font-semibold text-foreground">
              {t(`marketingPanel.segment.${segment}.title`)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t(`marketingPanel.segment.${segment}.description`)}
            </p>
            <p className="mt-2 text-xs font-medium text-primary">
              {t("marketingPanel.recipientCountShort").replace(
                "{count}",
                String(recipientCounts[segment] ?? 0),
              )}
            </p>
          </button>
        )
      })}
    </div>
  )
}
