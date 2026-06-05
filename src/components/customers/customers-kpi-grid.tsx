"use client"

import type { LucideIcon } from "lucide-react"
import { RefreshCw, UserMinus, UserPlus, Users } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { CustomerKpis } from "@/lib/customers/customer-types"

type KpiCardProps = {
  label: string
  value: string
  icon: LucideIcon
}

function KpiCard({ label, value, icon: Icon }: KpiCardProps) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card shadow-sm shadow-slate-900/[0.04] transition-shadow hover:shadow-md hover:shadow-slate-900/[0.06]">
      <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-[1.75rem]">
              {value}
            </p>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-[1.125rem]" aria-hidden />
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export type CustomersKpiCopy = {
  total: string
  newThisMonth: string
  returning: string
  lost: string
}

export function CustomersKpiGrid({ kpis, copy }: { kpis: CustomerKpis; copy: CustomersKpiCopy }) {
  const cards: KpiCardProps[] = [
    { label: copy.total, value: String(kpis.totalCustomers), icon: Users },
    { label: copy.newThisMonth, value: String(kpis.newThisMonth), icon: UserPlus },
    { label: copy.returning, value: String(kpis.returning), icon: RefreshCw },
    { label: copy.lost, value: String(kpis.lost), icon: UserMinus },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  )
}
