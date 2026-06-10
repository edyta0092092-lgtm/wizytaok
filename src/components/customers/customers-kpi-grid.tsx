"use client"

import type { LucideIcon } from "lucide-react"
import { RefreshCw, UserMinus, UserPlus, Users } from "lucide-react"

import { KpiCard } from "@/components/shared/kpi-card"
import type { CustomerKpis } from "@/lib/customers/customer-types"
import { cn } from "@/lib/utils"

export type CustomersKpiCopy = {
  total: string
  newThisMonth: string
  returning: string
  lost: string
}

export function CustomersKpiGrid({
  kpis,
  copy,
  className,
}: {
  kpis: CustomerKpis
  copy: CustomersKpiCopy
  className?: string
}) {
  const cards: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: copy.total, value: String(kpis.totalCustomers), icon: Users },
    { label: copy.newThisMonth, value: String(kpis.newThisMonth), icon: UserPlus },
    { label: copy.returning, value: String(kpis.returning), icon: RefreshCw },
    { label: copy.lost, value: String(kpis.lost), icon: UserMinus },
  ]

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {cards.map((card) => (
        <KpiCard key={card.label} {...card} />
      ))}
    </div>
  )
}
