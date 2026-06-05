"use client"

import { Card, CardContent } from "@/components/ui/card"
import type { LoyaltyDashboardMetrics } from "@/lib/loyalty/loyalty-types"

export function LoyaltyDashboardKpis({
  metrics,
  labels,
}: {
  metrics: LoyaltyDashboardMetrics
  labels: { participants: string; rewards: string; avgVisits: string }
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <KpiCard label={labels.participants} value={String(metrics.activeParticipants)} />
      <KpiCard label={labels.rewards} value={String(metrics.rewardsIssued)} />
      <KpiCard label={labels.avgVisits} value={String(metrics.avgVisitsAmongParticipants)} />
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="px-4 py-4">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
