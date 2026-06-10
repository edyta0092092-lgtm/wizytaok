"use client"

import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export type CustomersFiltersBarProps = {
  query: string
  onQueryChange: (value: string) => void
  isPending?: boolean
}

export function CustomersFiltersBar({
  query,
  onQueryChange,
  isPending = false,
}: CustomersFiltersBarProps) {
  const { t } = useTranslations()

  return (
    <div className="relative max-w-xl">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-[1.125rem] -translate-y-1/2 text-muted-foreground md:left-3 md:size-4"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t("customers.searchPlaceholder")}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className={cn(
          "h-12 touch-manipulation rounded-xl pl-11 text-base md:h-11 md:pl-10 md:text-sm",
          isPending && "opacity-80",
        )}
        aria-label={t("customers.searchAria")}
      />
    </div>
  )
}
