"use client"

import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CustomerSegmentFilter } from "@/lib/customers/customer-types"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

const SEGMENTS: CustomerSegmentFilter[] = ["all", "new", "returning", "loyal", "lost"]

export type CustomersFiltersBarProps = {
  query: string
  onQueryChange: (value: string) => void
  segment: CustomerSegmentFilter
  onSegmentChange: (value: CustomerSegmentFilter) => void
}

export function CustomersFiltersBar({
  query,
  onQueryChange,
  segment,
  onSegmentChange,
}: CustomersFiltersBarProps) {
  const { t } = useTranslations()

  return (
    <div className="flex flex-col gap-3">
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
      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((value) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={segment === value ? "default" : "outline"}
            className={cn("h-9 rounded-full px-4", segment === value && "shadow-sm")}
            onClick={() => onSegmentChange(value)}
          >
            {t(`customers.segmentFilter.${value}`)}
          </Button>
        ))}
      </div>
    </div>
  )
}
