"use client"

import { Mail, MessageSquare } from "lucide-react"

import type { MarketingChannel } from "@/lib/marketing/marketing-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export function MarketingMessagePreview({
  channel,
  previewText,
  subject,
}: {
  channel: MarketingChannel
  previewText: string
  subject?: string
}) {
  const { t } = useTranslations()
  const Icon = channel === "sms" ? MessageSquare : Mail

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("marketingPanel.previewTitle")}
      </p>
      <div
        className={cn(
          "rounded-2xl border border-border bg-muted/20 p-4",
          channel === "sms" ? "max-w-sm" : "max-w-lg",
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
          {channel === "sms" ? t("marketingPanel.channelSms") : t("marketingPanel.channelEmail")}
        </div>
        {channel === "email" && subject?.trim() ? (
          <p className="mb-2 text-sm font-semibold text-foreground">{subject.trim()}</p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {previewText.trim() || t("marketingPanel.previewEmpty")}
        </p>
      </div>
    </div>
  )
}
