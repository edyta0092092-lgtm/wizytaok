"use client"

import { Mail, MessageSquare, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import type { MarketingCampaign } from "@/lib/marketing/marketing-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function MarketingCampaignList({
  campaigns,
  onDelete,
}: {
  campaigns: MarketingCampaign[]
  onDelete: (id: string) => void
}) {
  const { t, language } = useTranslations()

  if (campaigns.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">{t("marketingPanel.tableName")}</th>
              <th className="px-4 py-3 font-medium">{t("marketingPanel.tableChannel")}</th>
              <th className="px-4 py-3 font-medium">{t("marketingPanel.tableStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("marketingPanel.tableRecipients")}</th>
              <th className="px-4 py-3 font-medium">{t("marketingPanel.tableCreated")}</th>
              <th className="px-4 py-3 font-medium">{t("marketingPanel.tableSent")}</th>
              <th className="w-12 px-2 py-3" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3 font-medium">{campaign.name}</td>
                <td className="px-4 py-3">
                  <ChannelBadge channel={campaign.channel} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={campaign.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">{campaign.recipientCount}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatCustomerDate(campaign.createdAt, language)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {campaign.sentAt ? formatCustomerDate(campaign.sentAt, language) : "—"}
                </td>
                <td className="px-2 py-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    onClick={() => onDelete(campaign.id)}
                    aria-label={t("marketingPanel.deleteCampaign")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="rounded-2xl border border-border shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{campaign.name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => onDelete(campaign.id)}
                  aria-label={t("marketingPanel.deleteCampaign")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <ChannelBadge channel={campaign.channel} />
                <StatusBadge status={campaign.status} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">{t("marketingPanel.tableRecipients")}</dt>
                  <dd className="font-semibold tabular-nums">{campaign.recipientCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("marketingPanel.tableCreated")}</dt>
                  <dd>{formatCustomerDate(campaign.createdAt, language)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ChannelBadge({ channel }: { channel: MarketingCampaign["channel"] }) {
  const { t } = useTranslations()
  const Icon = channel === "sms" ? MessageSquare : Mail
  return (
    <Badge variant="outline" className="gap-1 rounded-full font-normal">
      <Icon className="size-3" aria-hidden />
      {channel === "sms" ? t("marketingPanel.channelSms") : t("marketingPanel.channelEmail")}
    </Badge>
  )
}

function StatusBadge({ status }: { status: MarketingCampaign["status"] }) {
  const { t } = useTranslations()
  return (
    <Badge
      variant={status === "sent" ? "default" : "secondary"}
      className="rounded-full font-normal"
    >
      {status === "sent" ? t("marketingPanel.statusSent") : t("marketingPanel.statusDraft")}
    </Badge>
  )
}
