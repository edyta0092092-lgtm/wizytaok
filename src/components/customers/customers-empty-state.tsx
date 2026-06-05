"use client"

import { Users } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomersEmptyState({ filtered }: { filtered?: boolean }) {
  const { t } = useTranslations()
  return (
    <Card className="rounded-2xl border border-dashed border-border bg-card">
      <CardContent className="py-12 text-center">
        <Users className="mx-auto size-9 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-sm font-medium text-foreground">
          {filtered ? t("customers.emptyFiltered") : t("customers.emptyTitle")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filtered ? t("customers.emptyFilteredHint") : t("customers.emptyHint")}
        </p>
      </CardContent>
    </Card>
  )
}
