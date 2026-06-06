"use client"

import * as React from "react"
import { Check, Copy, Gift, Link2, Loader2, Users } from "lucide-react"

import { AccessDenied } from "@/components/shared/access-denied"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import type { ReferralConversionStage } from "@/lib/referrals/referral-stage"
import type { ReferralRewardEligibility } from "@/lib/referrals/referral-rewards"
import { useTranslations } from "@/lib/i18n/use-translations"

type ReferralStats = {
  registrations: number
  trialActivated: number
  paying: number
}

type ReferralHistoryRow = {
  id: string
  referralCode: string
  referredBusinessName: string
  stage: ReferralConversionStage
  registeredAt: string
  trialActivatedAt: string | null
  payingAt: string | null
}

type DashboardResponse = {
  ok: boolean
  persistenceReady: boolean
  code: string | null
  referralUrl: string | null
  stats: ReferralStats
  history: ReferralHistoryRow[]
  rewards: ReferralRewardEligibility[]
}

function formatDate(iso: string, locale: string): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return iso
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms))
}

function stageLabel(stage: ReferralConversionStage, t: (key: string) => string): string {
  switch (stage) {
    case "registered":
      return t("referralsPanel.stageRegistered")
    case "trial_activated":
      return t("referralsPanel.stageTrial")
    case "paying":
      return t("referralsPanel.stagePaying")
    default:
      return stage
  }
}

export function ReferralDashboard() {
  const { t, language } = useTranslations()
  const { ready: accessReady, canManageSettings } = useBusinessAccess()
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<DashboardResponse | null>(null)
  const [copiedField, setCopiedField] = React.useState<"link" | "code" | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/referrals/dashboard", { cache: "no-store" })
      const json = (await res.json()) as DashboardResponse & { error?: string }
      if (!res.ok || !json.ok) {
        setError(t("referralsPanel.loadError"))
        return
      }
      setData(json)
    } catch {
      setError(t("referralsPanel.loadError"))
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    if (!accessReady || !canManageSettings) return
    void load()
  }, [accessReady, canManageSettings, load])

  const copyText = async (value: string, field: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedField(field)
      window.setTimeout(() => setCopiedField(null), 2000)
    } catch {
      setError(t("referralsPanel.copyError"))
    }
  }

  if (accessReady && !canManageSettings) {
    return <AccessDenied />
  }

  if (loading) {
    return (
      <Card className="rounded-2xl border border-dashed">
        <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("referralsPanel.loading")}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="rounded-2xl border border-destructive/30">
        <CardContent className="space-y-4 py-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t("referralsPanel.retry")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const stats = data?.stats ?? { registrations: 0, trialActivated: 0, paying: 0 }
  const history = data?.history ?? []
  const rewards = data?.rewards ?? []
  const locale = language === "en" ? "en" : "pl"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Gift className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("referralsPanel.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("referralsPanel.lead")}</p>
        </div>
      </div>

      {!data?.persistenceReady ? (
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-5 text-sm leading-relaxed text-muted-foreground">
            {t("referralsPanel.migrationRequired")}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: "registrations", value: stats.registrations, label: t("referralsPanel.kpiRegistrations") },
          { key: "trial", value: stats.trialActivated, label: t("referralsPanel.kpiTrials") },
          { key: "paying", value: stats.paying, label: t("referralsPanel.kpiPaying") },
        ].map((item) => (
          <Card key={item.key} className="rounded-2xl shadow-none">
            <CardContent className="pt-5">
              <p className="text-2xl font-semibold tabular-nums">{item.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Link2 className="size-4 text-primary" aria-hidden />
            {t("referralsPanel.shareTitle")}
          </CardTitle>
          <CardDescription>{t("referralsPanel.shareLead")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("referralsPanel.codeLabel")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={data?.code ?? ""}
                className="font-mono text-base tracking-widest"
                aria-label={t("referralsPanel.codeLabel")}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 sm:min-w-[9rem]"
                disabled={!data?.code}
                onClick={() => data?.code && void copyText(data.code, "code")}
              >
                {copiedField === "code" ? (
                  <>
                    <Check className="mr-2 size-4" aria-hidden />
                    {t("referralsPanel.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 size-4" aria-hidden />
                    {t("referralsPanel.copyCode")}
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("referralsPanel.linkLabel")}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={data?.referralUrl ?? ""}
                className="text-sm"
                aria-label={t("referralsPanel.linkLabel")}
              />
              <Button
                type="button"
                className="shrink-0 sm:min-w-[9rem]"
                disabled={!data?.referralUrl}
                onClick={() => data?.referralUrl && void copyText(data.referralUrl, "link")}
              >
                {copiedField === "link" ? (
                  <>
                    <Check className="mr-2 size-4" aria-hidden />
                    {t("referralsPanel.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 size-4" aria-hidden />
                    {t("referralsPanel.copyLink")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Gift className="size-4 text-primary" aria-hidden />
            {t("referralsPanel.rewardsTitle")}
          </CardTitle>
          <CardDescription>{t("referralsPanel.rewardsLead")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rewards.map((tier) => (
            <div
              key={tier.tierCode}
              className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {language === "en" ? tier.labelEn : tier.labelPl}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("referralsPanel.rewardProgress").replace("{count}", String(stats.paying))}
                </p>
              </div>
              <Badge variant={tier.eligible ? "default" : "secondary"}>
                {tier.eligible ? t("referralsPanel.rewardEligible") : t("referralsPanel.rewardLocked")}
              </Badge>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted-foreground">{t("referralsPanel.rewardsManualNote")}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Users className="size-4 text-primary" aria-hidden />
            {t("referralsPanel.historyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("referralsPanel.historyEmpty")}</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {history.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.referredBusinessName}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("referralsPanel.historyRegistered")}: {formatDate(row.registeredAt, locale)}
                    </p>
                  </div>
                  <Badge variant="outline" className="w-fit shrink-0">
                    {stageLabel(row.stage, t)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
