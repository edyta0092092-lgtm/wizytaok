"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { computeCustomerPoints, qualifyingVisitCount } from "@/lib/loyalty/compute-loyalty"
import { readLoyaltyProgram } from "@/lib/loyalty/loyalty-program-storage"
import {
  appendLoyaltyReward,
  allocateLoyaltyRewardId,
  readLoyaltyRewardsForClient,
} from "@/lib/loyalty/loyalty-reward-storage"
import { computeCustomerLoyaltyState } from "@/lib/loyalty/compute-loyalty"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { formatCustomerDate } from "@/lib/customers/format-customer-datetime"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomerLoyaltyPanel({ customer }: { customer: CustomerCrmRow }) {
  const { t, language } = useTranslations()
  const { businessId } = useBusinessAccess()
  const [rewardTick, setRewardTick] = React.useState(0)

  const program = React.useMemo(
    () => (businessId ? readLoyaltyProgram(businessId) : null),
    [businessId, rewardTick],
  )

  const rewards = React.useMemo(
    () =>
      businessId ? readLoyaltyRewardsForClient(businessId, customer.id) : [],
    [businessId, customer.id, rewardTick],
  )

  const labelFactory = React.useMemo(
    () => ({
      pointsUnit: t("loyaltyPanel.pointsUnit"),
      visitsProgress: (current: number, target: number) =>
        t("loyaltyPanel.visitsProgress").replace("{current}", String(current)).replace("{target}", String(target)),
      rewardReady: (percent: number) =>
        t("loyaltyPanel.rewardReady").replace("{percent}", String(percent)),
      tierReached: (name: string) => t("loyaltyPanel.tierReached").replace("{name}", name),
      tierProgress: (current: number, target: number, name: string) =>
        t("loyaltyPanel.tierProgress")
          .replace("{current}", String(current))
          .replace("{target}", String(target))
          .replace("{name}", name),
      inactive: t("loyaltyPanel.programInactive"),
    }),
    [t],
  )

  if (!program || !program.enabled) {
    return (
      <Card className="rounded-2xl border border-dashed border-border/80">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("loyaltyPanel.profileProgramOff")}
        </CardContent>
      </Card>
    )
  }

  const state = computeCustomerLoyaltyState(customer, program, labelFactory)
  const visits = qualifyingVisitCount(customer)
  const points = computeCustomerPoints(customer, program)

  const handleIssueReward = () => {
    if (!businessId || !state.eligibleForReward) return
    let label = state.levelLabel
    if (program.kind === "visits_reward") {
      label = t("loyaltyPanel.rewardIssuedPercent").replace("{percent}", String(program.rewardPercent))
    } else if (program.kind === "vip_tier") {
      label = t("loyaltyPanel.rewardIssuedTier").replace("{name}", program.tierName)
    } else {
      label = t("loyaltyPanel.rewardIssuedPoints").replace("{points}", String(points))
    }
    appendLoyaltyReward({
      id: allocateLoyaltyRewardId(),
      businessId,
      clientId: customer.id,
      clientName: customer.fullName,
      programKind: program.kind,
      label,
      issuedAt: new Date().toISOString(),
      visitsAtIssue: visits,
      pointsAtIssue: points,
    })
    setRewardTick((n) => n + 1)
    toast.success(t("loyaltyPanel.rewardRecorded"))
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{t("loyaltyPanel.profileTitle")}</h2>
      <Card className="rounded-2xl border border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("loyaltyPanel.profileSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Stat label={t("loyaltyPanel.statVisits")} value={String(state.qualifyingVisits)} />
            <Stat label={t("loyaltyPanel.statPoints")} value={String(points)} />
            <Stat label={t("loyaltyPanel.statLevel")} value={state.levelLabel} className="sm:col-span-2" />
          </dl>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${state.progressPercent}%` }}
            />
          </div>
          {state.eligibleForReward ? (
            <Button type="button" className="h-10 rounded-xl" onClick={handleIssueReward}>
              {t("loyaltyPanel.recordReward")}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{t("loyaltyPanel.rewardHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("loyaltyPanel.rewardHistoryEmpty")}</p>
          ) : (
            <ul className="space-y-2">
              {rewards.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-muted/15 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCustomerDate(r.issuedAt, language)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
