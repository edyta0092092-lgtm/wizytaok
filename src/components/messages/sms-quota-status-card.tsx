"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, AlertTriangle, CheckCircle2, MessageSquare, Settings2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SmsBusinessStatus } from "@/lib/notifications/sms-business-status"
import type { SmsQuotaWarningLevel } from "@/lib/notifications/sms-quota-guard"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type SmsOverviewResponse = {
  ok?: boolean
  quota?: {
    used: number
    limit: number
    remaining: number | null
    allowed: boolean
    countFailed: boolean
    warningLevel?: SmsQuotaWarningLevel
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

function warningAlertClass(level: SmsQuotaWarningLevel): string {
  switch (level) {
    case "warning_10":
      return "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
    case "exhausted":
      return "border-destructive/35 bg-destructive/10 text-destructive"
    case "warning_20":
      return "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100"
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
  const warningLevel = quota?.warningLevel ?? "none"
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

  const usedSummary =
    quota && !quota.countFailed
      ? t("messages.smsOverview.usedSummaryValue")
          .replace("{used}", String(quota.used))
          .replace("{limit}", String(quota.limit))
      : "—"

  const remainingValue =
    quota && !quota.countFailed && quota.remaining != null ? String(quota.remaining) : "—"

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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("messages.smsOverview.usedSummary")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{usedSummary}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                <p className="text-xs text-muted-foreground">{t("messages.smsOverview.remainingSummary")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{remainingValue}</p>
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
                    className={cn(
                      "h-full rounded-full transition-all",
                      warningLevel === "exhausted" ? "bg-destructive" : "bg-primary",
                    )}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t("messages.smsOverview.countFailedHint")}
              </p>
            )}

            {warningLevel === "warning_20" ? (
              <div
                className={cn(
                  "flex gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
                  warningAlertClass("warning_20"),
                )}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{t("messages.smsOverview.warning20")}</p>
              </div>
            ) : null}

            {warningLevel === "warning_10" ? (
              <div
                className={cn(
                  "flex gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
                  warningAlertClass("warning_10"),
                )}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p>{t("messages.smsOverview.warning10")}</p>
              </div>
            ) : null}

            {warningLevel === "exhausted" ? (
              <div
                className={cn(
                  "space-y-1 rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
                  warningAlertClass("exhausted"),
                )}
              >
                <p className="font-semibold">{t("messages.smsOverview.exhaustedTitle")}</p>
                <p>{t("messages.smsOverview.exhaustedLine1")}</p>
                <p>{t("messages.smsOverview.exhaustedLine2")}</p>
              </div>
            ) : null}

            {status !== "active" && warningLevel !== "exhausted" ? (
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
