"use client"

import * as React from "react"

import { CustomersExportButton } from "@/components/exports/customers-export-button"
import { CustomersEmptyState } from "@/components/customers/customers-empty-state"
import { CustomersFiltersBar } from "@/components/customers/customers-filters-bar"
import { CustomersKpiGrid } from "@/components/customers/customers-kpi-grid"
import { CustomersList } from "@/components/customers/customers-list"
import { CustomersListSkeleton } from "@/components/customers/customers-list-skeleton"
import { filterCustomerRows } from "@/lib/customers/filter-customers"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { useCustomersCrm } from "@/lib/customers/use-customers-crm"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

function CustomersListSection({
  ready,
  loadError,
  filtered,
  totalRows,
  t,
}: {
  ready: boolean
  loadError: boolean
  filtered: CustomerCrmRow[]
  totalRows: number
  t: (key: string) => string
}) {
  if (!ready) return <CustomersListSkeleton />

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {t("customers.loadError")}
      </p>
    )
  }

  if (filtered.length === 0) {
    return <CustomersEmptyState filtered={totalRows > 0} />
  }

  return <CustomersList rows={filtered} />
}

export function CustomersPage() {
  const { t } = useTranslations()
  const { ready: accessReady, businessId } = useBusinessAccess()
  const { ready, loadError, rows, kpis } = useCustomersCrm(
    accessReady && businessId ? businessId : undefined,
  )

  const [query, setQuery] = React.useState("")
  const deferredQuery = React.useDeferredValue(query)

  const filtered = React.useMemo(
    () => filterCustomerRows(rows, deferredQuery, "all"),
    [rows, deferredQuery],
  )

  const isSearchPending = query !== deferredQuery

  const kpiCopy = React.useMemo(
    () => ({
      total: t("customers.kpi.total"),
      newThisMonth: t("customers.kpi.newThisMonth"),
    }),
    [t],
  )

  const searchToolbar = (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        <CustomersFiltersBar
          query={query}
          onQueryChange={setQuery}
          isPending={isSearchPending}
        />
      </div>
      <CustomersExportButton
        rows={filtered}
        className="h-11 shrink-0 touch-manipulation gap-1.5 rounded-xl px-3 text-sm lg:h-9"
      />
    </div>
  )

  const listSection = (
    <CustomersListSection
      ready={ready}
      loadError={loadError}
      filtered={filtered}
      totalRows={rows.length}
      t={t}
    />
  )

  return (
    <div className="flex flex-col">
      {/* Desktop: KPI → wyszukiwarka → lista (bez zmian) */}
      <div className="hidden flex-col gap-6 lg:flex">
        <CustomersKpiGrid kpis={kpis} copy={kpiCopy} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {searchToolbar}
        </div>
        {listSection}
      </div>

      {/* Mobile: KPI → wyszukiwarka (sticky) → lista */}
      <div className="flex flex-col gap-4 lg:hidden">
        <CustomersKpiGrid
          kpis={kpis}
          copy={kpiCopy}
          className="grid-cols-2 gap-2.5"
          cardClassName="min-h-[5.5rem] touch-manipulation"
        />

        <div
          className={cn(
            "sticky top-0 z-20 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-md",
            "supports-[backdrop-filter]:bg-background/80",
          )}
        >
          {searchToolbar}
        </div>

        {listSection}
      </div>
    </div>
  )
}
