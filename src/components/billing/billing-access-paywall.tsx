"use client"

import Link from "next/link"
import { CreditCard, LogOut, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient } from "@/lib/supabase/client"

type BillingAccessPaywallProps = {
  variant: "owner" | "staff"
}

export function BillingAccessPaywall({ variant }: BillingAccessPaywallProps) {
  const { t } = useTranslations()

  const logout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    window.location.href = "/login"
  }

  const title =
    variant === "owner" ? t("access.activateTitle") : t("access.staffInactiveTitle")
  const description =
    variant === "owner"
      ? t("access.activateDescription")
      : t("access.staffInactiveDescription")

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {variant === "owner" ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button type="button" className="h-11 rounded-xl" asChild>
                  <Link href="/start-trial">{t("access.activateTrialCta")}</Link>
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-xl" asChild>
                  <Link href="/settings?billing=required">{t("access.activatePaymentCta")}</Link>
                </Button>
              </div>
              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>{t("access.activatePaymentPending")}</span>
              </p>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-0 text-muted-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="mr-2 size-4" aria-hidden />
            {t("auth.logOut")}
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
