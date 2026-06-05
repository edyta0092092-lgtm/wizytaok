"use client"

import * as React from "react"

import { MarketingLegalNotice } from "@/components/marketing/marketing-legal-notice"
import { MarketingMessagePreview } from "@/components/marketing/marketing-message-preview"
import { MarketingSegmentPicker } from "@/components/marketing/marketing-segment-picker"
import { MarketingSendBlocked } from "@/components/marketing/marketing-send-blocked"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  filterCustomersByMarketingSegment,
  MARKETING_AUDIENCE_SEGMENTS,
} from "@/lib/marketing/marketing-audience"
import { renderMarketingMessagePreview } from "@/lib/marketing/marketing-message-preview"
import { countSmsUnits } from "@/lib/marketing/sms-message-stats"
import type {
  MarketingAudienceSegment,
  MarketingCampaignDraft,
  MarketingChannel,
} from "@/lib/marketing/marketing-types"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

const emptyDraft = (): MarketingCampaignDraft => ({
  name: "",
  channel: "sms",
  audienceSegment: "all",
  messageBody: "",
})

export function MarketingCampaignForm({
  customerRows,
  businessName,
  countRecipients,
  onSaveDraft,
}: {
  customerRows: CustomerCrmRow[]
  businessName: string
  countRecipients: (segment: MarketingAudienceSegment) => number
  onSaveDraft: (draft: MarketingCampaignDraft) => void
}) {
  const { t } = useTranslations()
  const [draft, setDraft] = React.useState(emptyDraft)
  const [savedNotice, setSavedNotice] = React.useState(false)

  const recipientCounts = React.useMemo(() => {
    const map = {} as Record<MarketingAudienceSegment, number>
    for (const segment of MARKETING_AUDIENCE_SEGMENTS) {
      map[segment] = countRecipients(segment)
    }
    return map
  }, [countRecipients])

  const selectedCount = recipientCounts[draft.audienceSegment] ?? 0

  const sampleCustomer = React.useMemo(() => {
    const matched = filterCustomersByMarketingSegment(customerRows, draft.audienceSegment)
    return matched[0] ?? customerRows[0] ?? null
  }, [customerRows, draft.audienceSegment])

  const previewText = React.useMemo(
    () => renderMarketingMessagePreview(draft.messageBody, sampleCustomer, businessName),
    [draft.messageBody, sampleCustomer, businessName],
  )

  const smsStats = countSmsUnits(draft.messageBody)

  const canSave =
    draft.name.trim().length > 0 && draft.messageBody.trim().length > 0 && selectedCount > 0

  const handleSave = () => {
    if (!canSave) return
    onSaveDraft({
      ...draft,
      name: draft.name.trim(),
      messageBody: draft.messageBody.trim(),
    })
    setDraft(emptyDraft())
    setSavedNotice(true)
    window.setTimeout(() => setSavedNotice(false), 4000)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t("marketingPanel.formTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <MarketingLegalNotice />

          <div className="grid gap-2">
            <Label htmlFor="campaign-name">{t("marketingPanel.fieldName")}</Label>
            <Input
              id="campaign-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              className="h-11 rounded-xl"
              placeholder={t("marketingPanel.fieldNamePlaceholder")}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="campaign-channel">{t("marketingPanel.fieldChannel")}</Label>
              <NativeSelect
                id="campaign-channel"
                value={draft.channel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, channel: e.target.value as MarketingChannel }))
                }
                className="h-11 w-full rounded-xl"
              >
                <option value="sms">{t("marketingPanel.channelSms")}</option>
                <option value="email">{t("marketingPanel.channelEmail")}</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col justify-end rounded-xl border border-border bg-muted/20 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{t("marketingPanel.recipientPreview")}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{selectedCount}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("marketingPanel.fieldSegment")}</Label>
            <MarketingSegmentPicker
              value={draft.audienceSegment}
              onChange={(segment) => setDraft((d) => ({ ...d, audienceSegment: segment }))}
              recipientCounts={recipientCounts}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campaign-body">{t("marketingPanel.fieldMessage")}</Label>
            <Textarea
              id="campaign-body"
              value={draft.messageBody}
              onChange={(e) => setDraft((d) => ({ ...d, messageBody: e.target.value }))}
              className="min-h-32 rounded-xl"
              placeholder={t("marketingPanel.fieldMessagePlaceholder")}
            />
            <p className="text-xs text-muted-foreground">{t("marketingPanel.variablesHint")}</p>
            {draft.channel === "sms" ? (
              <p className="text-xs font-medium text-muted-foreground">
                {t("marketingPanel.smsCounter")
                  .replace("{length}", String(smsStats.length))
                  .replace("{segments}", String(smsStats.segments))}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="h-10 rounded-xl"
              disabled={!canSave}
              onClick={handleSave}
            >
              {t("marketingPanel.saveDraft")}
            </Button>
            {savedNotice ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
                {t("marketingPanel.draftSaved")}
              </p>
            ) : null}
          </div>

          <MarketingSendBlocked />
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <MarketingMessagePreview channel={draft.channel} previewText={previewText} />
        <Card className="rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <CardContent className="px-4 py-4 text-xs leading-relaxed text-muted-foreground">
            {t("marketingPanel.previewNote")}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
