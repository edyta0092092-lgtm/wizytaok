"use client"

import { CreditCard, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient } from "@/lib/supabase/client"

export function StaffBillingAccessPaywall() {
  const { t } = useTranslations()

  const logout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    window.location.href = "/login"
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{t("access.staffInactiveTitle")}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t("access.staffInactiveDescription")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
