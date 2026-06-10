"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, MessageSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
    warningLevel?: SmsQuotaWarningLevel
  }
  status?: SmsBusinessStatus
}

export function DashboardSmsAlert() {
  const { t } = useTranslations()
  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<SmsOverviewResponse | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/business/sms-overview", { cache: "no-store" })
        const json = (await res.json()) as SmsOverviewResponse
        if (!cancelled) setData(json.ok ? json : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null

  const status = data?.status ?? "needs_configuration"
  const warningLevel = data?.quota?.warningLevel ?? "none"
  const showAlert =
    status !== "active" || warningLevel === "warning_10" || warningLevel === "warning_20" || warningLevel === "exhausted"

  if (!showAlert) return null

  const message =
    warningLevel === "exhausted"
      ? t("dashboard.smsAlertExhausted")
      : warningLevel === "warning_10" || warningLevel === "warning_20"
        ? t("dashboard.smsAlertLow")
        : status === "needs_template"
          ? t("dashboard.smsAlertNeedsTemplate")
          : t("dashboard.smsAlertNeedsConfiguration")

  return (
    <Card
      className={cn(
        "rounded-2xl border shadow-sm",
        warningLevel === "exhausted"
          ? "border-destructive/30 bg-destructive/5"
          : "border-amber-500/30 bg-amber-500/5",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-amber-700 dark:text-amber-200">
            {warningLevel === "exhausted" ? (
              <AlertCircle className="size-5" aria-hidden />
            ) : (
              <MessageSquare className="size-5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("dashboard.smsAlertTitle")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{message}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 touch-manipulation rounded-xl"
          asChild
        >
          <Link href="/messages">{t("dashboard.smsAlertAction")}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
