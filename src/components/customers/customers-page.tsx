"use client"

import * as React from "react"

import { CustomersEmptyState } from "@/components/customers/customers-empty-state"
import { CustomersFiltersBar } from "@/components/customers/customers-filters-bar"
import { CustomersKpiGrid } from "@/components/customers/customers-kpi-grid"
import { CustomersList } from "@/components/customers/customers-list"
import { CustomersListSkeleton } from "@/components/customers/customers-list-skeleton"
import { filterCustomerRows } from "@/lib/customers/filter-customers"
import type { CustomerSegmentFilter } from "@/lib/customers/customer-types"
import { useCustomersCrm } from "@/lib/customers/use-customers-crm"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomersPage() {
  const { t } = useTranslations()
  const { ready: accessReady, businessId } = useBusinessAccess()
  const { ready, loadError, rows, kpis } = useCustomersCrm(
    accessReady && businessId ? businessId : undefined,
  )

  const [query, setQuery] = React.useState("")
  const [segment, setSegment] = React.useState<CustomerSegmentFilter>("all")

  const filtered = React.useMemo(
    () => filterCustomerRows(rows, query, segment),
    [rows, query, segment],
  )

  const kpiCopy = React.useMemo(
    () => ({
      total: t("customers.kpi.total"),
      newThisMonth: t("customers.kpi.newThisMonth"),
      returning: t("customers.kpi.returning"),
      lost: t("customers.kpi.lost"),
    }),
    [t],
  )

  return (
    <div className="flex flex-col gap-6">
      <CustomersKpiGrid kpis={kpis} copy={kpiCopy} />

      <CustomersFiltersBar
        query={query}
        onQueryChange={setQuery}
        segment={segment}
        onSegmentChange={setSegment}
      />

      {!ready ? <CustomersListSkeleton /> : null}

      {ready && loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {t("customers.loadError")}
        </p>
      ) : null}

      {ready && !loadError && filtered.length === 0 ? (
        <CustomersEmptyState filtered={rows.length > 0} />
      ) : null}

      {ready && !loadError && filtered.length > 0 ? <CustomersList rows={filtered} /> : null}
    </div>
  )
}
