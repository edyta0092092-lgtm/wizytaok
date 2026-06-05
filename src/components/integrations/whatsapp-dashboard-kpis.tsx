"use client"

import { AlertCircle, CheckCircle2, Send } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { WhatsAppDeliveryStats } from "@/lib/integrations/whatsapp/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function WhatsAppDashboardKpis({ stats }: { stats: WhatsAppDeliveryStats }) {
  const { t } = useTranslations()
  const items = [
    {
      key: "sent",
      label: t("whatsappIntegration.statsSent"),
      value: stats.sent,
      icon: Send,
      className: "text-primary",
    },
    {
      key: "delivered",
      label: t("whatsappIntegration.statsDelivered"),
      value: stats.delivered,
      icon: CheckCircle2,
      className: "text-emerald-600",
    },
    {
      key: "errors",
      label: t("whatsappIntegration.statsErrors"),
      value: stats.errors,
      icon: AlertCircle,
      className: "text-destructive",
    },
  ] as const

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map(({ key, label, value, icon: Icon, className }) => (
        <Card key={key} className="rounded-xl border border-border/80 shadow-none">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted ${className}`}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
