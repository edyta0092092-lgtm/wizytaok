"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, MessageSquare, Settings2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SmsBusinessStatus } from "@/lib/notifications/sms-business-status"
import { useTranslations } from "@/lib/i18n/use-translations"

type SmsOverviewResponse = {
  ok?: boolean
  quota?: {
    used: number
    limit: number
    remaining: number | null
    allowed: boolean
    countFailed: boolean
  }
  status?: SmsBusinessStatus
}

function statusBadgeClass(status: SmsBusinessStatus): string {
  switch (status) {
    case "active":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
    case "needs_template":
      return "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200"
    case "needs_configuration":
      return "border-destructive/30 bg-destructive/10 text-destructive"
    default:
      return ""
  }
}

export function SmsQuotaStatusCard() {
  const { t } = useTranslations()
  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<SmsOverviewResponse | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/business/sms-overview", { cache: "no-store" })
      const json = (await res.json()) as SmsOverviewResponse
      if (json.ok) setData(json)
      else setData(null)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const quota = data?.quota
  const status = data?.status ?? "needs_configuration"
  const statusLabelKey =
    status === "active"
      ? "messages.smsOverview.statusActive"
      : status === "needs_template"
        ? "messages.smsOverview.statusNeedsTemplate"
        : "messages.smsOverview.statusNeedsConfiguration"

  const usagePercent =
    quota && quota.limit > 0 && !quota.countFailed
      ? Math.min(100, Math.round((quota.used / quota.limit) * 100))
      : 0

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-border/70 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MessageSquare className="size-5" aria-hidden />
            </span>
            <div>
              <CardTitle className="text-sm font-semibold">{t("messages.smsOverview.title")}</CardTitle>
              <CardDescription className="mt-1 text-xs text-muted-foreground">
                {t("messages.smsOverview.lead")}
              </CardDescription>
            </div>
          </div>
          {!loading ? (
            <Badge variant="outline" className={`w-fit rounded-lg ${statusBadgeClass(status)}`}>
              {status === "active" ? (
                <CheckCircle2 className="mr-1 size-3.5" aria-hidden />
              ) : (
                <AlertCircle className="mr-1 size-3.5" aria-hidden />
              )}
              {t(statusLabelKey)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("messages.smsOverview.loading")}</p>
        ) : !quota ? (
          <p className="text-sm text-muted-foreground">{t("messages.smsOverview.loadError")}</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("messages.smsOverview.usedLabel")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {quota.countFailed ? "—" : quota.used}
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("messages.smsOverview.limitLabel")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{quota.limit}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("messages.smsOverview.remainingLabel")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {quota.countFailed || quota.remaining == null ? "—" : quota.remaining}
                </p>
              </div>
            </div>

            {!quota.countFailed ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("messages.smsOverview.usageCaption")}</span>
                  <span className="tabular-nums">
                    {quota.used} / {quota.limit}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("messages.smsOverview.countFailedHint")}
              </p>
            )}

            {status !== "active" ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {status === "needs_template"
                  ? t("messages.smsOverview.needsTemplateHint")
                  : t("messages.smsOverview.needsConfigurationHint")}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {status === "needs_template" ? (
                <Button asChild type="button" variant="secondary" size="sm" className="h-9 rounded-xl">
                  <Link href="#message-templates">{t("messages.smsOverview.openTemplatesCta")}</Link>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() => void load()}
              >
                <Settings2 className="mr-1.5 size-3.5" aria-hidden />
                {t("messages.smsOverview.refresh")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
