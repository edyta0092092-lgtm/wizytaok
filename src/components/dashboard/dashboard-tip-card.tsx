"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"

const DASHBOARD_TIP_COUNT = 16

export function DashboardTipCard() {
  const { t } = useTranslations()
  const [tipIndex, setTipIndex] = React.useState(
    () => new Date().getDate() % DASHBOARD_TIP_COUNT,
  )

  const tipKey = `dashboard.tipItems.${tipIndex}`

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-row items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <CardTitle className="text-sm font-semibold">{t("dashboard.tip")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed text-muted-foreground">{t(tipKey)}</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setTipIndex((i) => (i + 1) % DASHBOARD_TIP_COUNT)}
        >
          {t("dashboard.tipShowAnother")}
        </Button>
      </CardContent>
    </Card>
  )
}
