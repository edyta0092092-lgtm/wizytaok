"use client"

import * as React from "react"
import { HeartHandshake } from "lucide-react"

import { LoyaltyDashboardKpis } from "@/components/loyalty/loyalty-dashboard-kpis"
import { LoyaltyProgramSettings } from "@/components/loyalty/loyalty-program-settings"
import { LoyaltyProgramTypeCards } from "@/components/loyalty/loyalty-program-type-cards"
import { AccessDenied } from "@/components/shared/access-denied"
import { Card, CardContent } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useLoyaltyWorkspace } from "@/lib/loyalty/use-loyalty-workspace"
import type { LoyaltyProgramKind } from "@/lib/loyalty/loyalty-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function LoyaltyPage() {
  const { t } = useTranslations()
  const { ready: accessReady, businessId, canManageSettings } = useBusinessAccess()

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

  const { ready, program, dashboard, saveProgram } = useLoyaltyWorkspace(
    accessReady ? businessId : undefined,
    labelFactory,
  )

  if (accessReady && !canManageSettings) {
    return <AccessDenied />
  }

  const typeCards: Array<{
    kind: LoyaltyProgramKind
    title: string
    description: string
    example: string
  }> = [
    {
      kind: "visits_reward",
      title: t("loyaltyPanel.typeVisitsTitle"),
      description: t("loyaltyPanel.typeVisitsDesc"),
      example: t("loyaltyPanel.typeVisitsExample"),
    },
    {
      kind: "points",
      title: t("loyaltyPanel.typePointsTitle"),
      description: t("loyaltyPanel.typePointsDesc"),
      example: t("loyaltyPanel.typePointsExample"),
    },
    {
      kind: "vip_tier",
      title: t("loyaltyPanel.typeVipTitle"),
      description: t("loyaltyPanel.typeVipDesc"),
      example: t("loyaltyPanel.typeVipExample"),
    },
  ]

  const handleSelectKind = (kind: LoyaltyProgramKind) => {
    if (!program) return
    saveProgram({ ...program, kind })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HeartHandshake className="size-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("loyaltyPanel.heading")}</h2>
          <p className="text-sm text-muted-foreground">{t("loyaltyPanel.lead")}</p>
        </div>
      </div>

      {!ready || !program ? (
        <Card className="rounded-2xl border border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("loyaltyPanel.loading")}
          </CardContent>
        </Card>
      ) : (
        <>
          <LoyaltyDashboardKpis
            metrics={dashboard}
            labels={{
              participants: t("loyaltyPanel.kpiParticipants"),
              rewards: t("loyaltyPanel.kpiRewards"),
              avgVisits: t("loyaltyPanel.kpiAvgVisits"),
            }}
          />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("loyaltyPanel.programTypesTitle")}</h3>
            <LoyaltyProgramTypeCards
              activeKind={program.kind}
              onSelect={handleSelectKind}
              cards={typeCards}
            />
          </section>

          <LoyaltyProgramSettings program={program} onSave={saveProgram} />

          <p className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            {t("loyaltyPanel.foundationNote")}
          </p>
        </>
      )}
    </div>
  )
}
