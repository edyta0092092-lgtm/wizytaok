"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export function TestBillingSettingsCard() {
  const { t } = useTranslations()
  const { ready, effectiveRole } = useBusinessAccess()
  const [flags, setFlags] = React.useState<{ enableTestBilling: boolean } | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/config/test-integrations")
        const data = (await res.json()) as { enableTestBilling?: boolean }
        if (!cancelled) {
          setFlags({ enableTestBilling: data.enableTestBilling === true })
        }
      } catch {
        if (!cancelled) setFlags({ enableTestBilling: false })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const p = new URLSearchParams(window.location.search).get("stripe_test")
    if (p === "success") toast.success(t("settings.testBillingSuccess"))
    if (p === "cancel") toast(t("settings.testBillingCancel"))
  }, [t])

  if (!ready || effectiveRole !== "admin") return null
  if (!flags?.enableTestBilling) return null

  return (
    <Card className="rounded-2xl border border-dashed border-violet-500/35 bg-violet-50/30 shadow-sm dark:bg-violet-950/20">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{t("settings.testBillingTitle")}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {t("settings.testBillingLead")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <p className="text-xs text-muted-foreground">{t("settings.testBillingStripeNote")}</p>
        <Button
          type="button"
          className="h-11 rounded-xl"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const res = await fetch("/api/test-billing/checkout", { method: "POST" })
              const data = (await res.json()) as {
                ok?: boolean
                url?: string
                error?: string
                hint?: string
              }
              if (res.ok && data.url) {
                window.location.href = data.url
                return
              }
              toast.error(data.hint || data.error || t("settings.testBillingFailed"))
            } catch {
              toast.error(t("settings.testBillingFailed"))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? t("settings.testBillingBusy") : t("settings.testBillingCta")}
        </Button>
      </CardContent>
    </Card>
  )
}
