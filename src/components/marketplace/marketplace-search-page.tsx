"use client"

import * as React from "react"
import Link from "next/link"

import { MarketplaceCompanyCard } from "@/components/marketplace/marketplace-company-card"
import { MarketplaceSearchFiltersPanel } from "@/components/marketplace/marketplace-search-filters"
import type { MarketplaceListing, MarketplaceSearchFilters } from "@/lib/marketplace/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function MarketplaceSearchPage() {
  const { t } = useTranslations()
  const [filters, setFilters] = React.useState<MarketplaceSearchFilters>({})
  const [listings, setListings] = React.useState<MarketplaceListing[]>([])
  const [cities, setCities] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async (activeFilters: MarketplaceSearchFilters) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeFilters.city?.trim()) params.set("city", activeFilters.city.trim())
      if (activeFilters.category?.trim() && activeFilters.category !== "all") {
        params.set("category", activeFilters.category.trim())
      }
      if (activeFilters.companyName?.trim()) params.set("company", activeFilters.companyName.trim())
      if (activeFilters.service?.trim()) params.set("service", activeFilters.service.trim())
      const qs = params.toString()
      const res = await fetch(`/api/marketplace/search${qs ? `?${qs}` : ""}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        listings?: MarketplaceListing[]
        cities?: string[]
      }
      if (json.ok) {
        setListings(json.listings ?? [])
        setCities(json.cities ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load({})
  }, [load])

  const categoryLabel = (labelKey: string) => t(`marketplacePanel.${labelKey}`)

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              WizytaOK
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("marketplacePanel.pageTitle")}
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {t("marketplacePanel.pageLead")}
            </p>
          </div>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("marketplacePanel.businessPanelLink")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <p className="rounded-xl border border-dashed border-border bg-card/80 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t("marketplacePanel.foundationNotice")}
        </p>

        <MarketplaceSearchFiltersPanel
          filters={filters}
          cities={cities}
          onChange={setFilters}
          onSubmit={() => void load(filters)}
          labels={{
            city: t("marketplacePanel.filterCity"),
            category: t("marketplacePanel.filterCategory"),
            company: t("marketplacePanel.filterCompany"),
            service: t("marketplacePanel.filterService"),
            cityPlaceholder: t("marketplacePanel.filterCityAll"),
            companyPlaceholder: t("marketplacePanel.filterCompanyPlaceholder"),
            servicePlaceholder: t("marketplacePanel.filterServicePlaceholder"),
            allCategories: t("marketplacePanel.filterCategoryAll"),
            search: t("marketplacePanel.searchButton"),
            categoryOption: (key) => t(`marketplacePanel.${key}`),
          }}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("marketplacePanel.loading")}</p>
        ) : listings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            {t("marketplacePanel.emptyResults")}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t("marketplacePanel.resultsCount").replace("{count}", String(listings.length))}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <MarketplaceCompanyCard
                  key={listing.id}
                  listing={listing}
                  categoryLabel={categoryLabel}
                  bookLabel={t("marketplacePanel.bookAppointment")}
                  profileLabel={t("marketplacePanel.viewProfile")}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
