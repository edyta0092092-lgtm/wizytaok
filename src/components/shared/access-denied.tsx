"use client"

import { ShieldOff } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"

type AccessDeniedProps = {
  /** Opcjonalny drugi akapit (np. tylko administrator…). */
  hintKey?: string
}

export function AccessDenied({ hintKey }: AccessDeniedProps) {
  const { t } = useTranslations()
  return (
    <Card className="max-w-lg border-dashed">
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
          <ShieldOff className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{t("access.deniedTitle")}</CardTitle>
          <CardDescription>{t("access.deniedBody")}</CardDescription>
        </div>
      </CardHeader>
      {hintKey ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{t(hintKey)}</p>
        </CardContent>
      ) : null}
    </Card>
  )
}
