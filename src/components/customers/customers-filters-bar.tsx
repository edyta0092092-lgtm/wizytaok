"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useTranslations } from "@/lib/i18n/use-translations"

export type CustomersFiltersBarProps = {
  query: string
  onQueryChange: (value: string) => void
}

export function CustomersFiltersBar({ query, onQueryChange }: CustomersFiltersBarProps) {
  const { t } = useTranslations()

  return (
    <div className="relative max-w-xl">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t("customers.searchPlaceholder")}
        className="h-11 rounded-xl pl-10"
        aria-label={t("customers.searchAria")}
      />
    </div>
  )
}
