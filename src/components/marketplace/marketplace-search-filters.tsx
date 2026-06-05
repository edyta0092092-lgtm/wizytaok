"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories"
import type { MarketplaceSearchFilters } from "@/lib/marketplace/types"

export function MarketplaceSearchFiltersPanel({
  filters,
  cities,
  onChange,
  onSubmit,
  labels,
}: {
  filters: MarketplaceSearchFilters
  cities: string[]
  onChange: (next: MarketplaceSearchFilters) => void
  onSubmit: () => void
  labels: {
    city: string
    category: string
    company: string
    service: string
    cityPlaceholder: string
    companyPlaceholder: string
    servicePlaceholder: string
    allCategories: string
    search: string
    categoryOption: (labelKey: string) => string
  }
}) {
  return (
    <form
      className="grid gap-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <Field label={labels.city}>
        <NativeSelect
          className="h-10 w-full rounded-xl"
          value={filters.city ?? ""}
          onChange={(e) => onChange({ ...filters, city: e.target.value })}
        >
          <option value="">{labels.cityPlaceholder}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={labels.category}>
        <NativeSelect
          className="h-10 w-full rounded-xl"
          value={filters.category ?? "all"}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          <option value="all">{labels.allCategories}</option>
          {MARKETPLACE_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {labels.categoryOption(cat.labelKey)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={labels.company}>
        <Input
          className="h-10 rounded-xl"
          placeholder={labels.companyPlaceholder}
          value={filters.companyName ?? ""}
          onChange={(e) => onChange({ ...filters, companyName: e.target.value })}
        />
      </Field>
      <Field label={labels.service}>
        <Input
          className="h-10 rounded-xl"
          placeholder={labels.servicePlaceholder}
          value={filters.service ?? ""}
          onChange={(e) => onChange({ ...filters, service: e.target.value })}
        />
      </Field>
      <div className="flex items-end">
        <Button type="submit" className="h-10 w-full rounded-xl">
          <Search className="mr-1.5 size-4" aria-hidden />
          {labels.search}
        </Button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}
