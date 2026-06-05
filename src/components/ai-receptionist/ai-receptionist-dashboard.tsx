"use client"

import { Bot, CalendarCheck, MessageSquare } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { AiReceptionistConfig, AiReceptionistStats } from "@/lib/ai-receptionist/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AiReceptionistDashboard({
  config,
  stats,
}: {
  config: AiReceptionistConfig
  stats: AiReceptionistStats
}) {
  const { t } = useTranslations()

  const toneLabel =
    config.tone === "friendly"
      ? t("aiReceptionistPanel.toneFriendly")
      : config.tone === "professional"
        ? t("aiReceptionistPanel.toneProfessional")
        : t("aiReceptionistPanel.toneConcise")

  const languageLabel =
    config.language === "pl"
      ? t("aiReceptionistPanel.languagePl")
      : t("aiReceptionistPanel.languageEn")

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600">
          <Bot className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("aiReceptionistPanel.dashboardTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("aiReceptionistPanel.dashboardLead")}</p>
        </div>
        <Badge
          variant={config.enabled ? "default" : "secondary"}
          className={
            config.enabled
              ? "rounded-lg bg-violet-600 hover:bg-violet-600"
              : "rounded-lg"
          }
        >
          {config.enabled
            ? t("aiReceptionistPanel.statusEnabled")
            : t("aiReceptionistPanel.statusDisabled")}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={MessageSquare}
          label={t("aiReceptionistPanel.kpiConversations")}
          value={String(stats.conversationCount)}
        />
        <KpiCard
          icon={CalendarCheck}
          label={t("aiReceptionistPanel.kpiBookings")}
          value={String(stats.bookingsFromAi)}
        />
        <Card className="rounded-2xl border-border/60 shadow-sm sm:col-span-2 lg:col-span-1">
          <CardContent className="space-y-2 px-4 py-4 text-sm">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {t("aiReceptionistPanel.configSummaryTitle")}
            </p>
            <dl className="space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("aiReceptionistPanel.assistantNameLabel")}</dt>
                <dd className="font-medium text-foreground">{config.assistantName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("aiReceptionistPanel.toneLabel")}</dt>
                <dd className="font-medium text-foreground">{toneLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t("aiReceptionistPanel.languageLabel")}</dt>
                <dd className="font-medium text-foreground">{languageLabel}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageSquare
  label: string
  value: string
}) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="flex items-center gap-3 px-4 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-violet-600">
          <Icon className="size-4" aria-hidden />
        </span>
        <div>
          <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
