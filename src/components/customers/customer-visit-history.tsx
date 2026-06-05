"use client"

import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCustomerDateTime } from "@/lib/customers/format-customer-datetime"
import type { CustomerVisitRow } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomerVisitHistory({ visits }: { visits: CustomerVisitRow[] }) {
  const { t, language } = useTranslations()

  if (visits.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {t("customers.profile.noVisits")}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-2xl border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("customers.profile.historyTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {visits.map((visit) => (
          <div
            key={visit.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium text-foreground">
                {formatCustomerDateTime(visit.startsAt, language)}
              </p>
              <p className="text-sm text-muted-foreground">{visit.serviceLabel}</p>
              <p className="text-xs text-muted-foreground">
                {t("customers.profile.staffLine")}: {visit.staffName}
              </p>
            </div>
            <StatusBadge status={visit.status} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
