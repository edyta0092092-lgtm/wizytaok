"use client"

import { AccountCredentialsPanel } from "@/components/account/account-credentials-panel"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function AccountPage() {
  const { t } = useTranslations()
  const access = useBusinessAccess()

  return (
    <AppShell title={t("account.title")} pageDescription={t("account.description")}>
      <PageShell>
        {!access.ready ? (
          <p className="text-sm text-muted-foreground">{"\u00a0"}</p>
        ) : !access.businessId ? (
          <p className="text-sm text-muted-foreground">{t("account.noBusiness")}</p>
        ) : (
          <div className="w-full min-w-0 space-y-4">
            <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("account.credentialsTitle")}</CardTitle>
                <CardDescription>{t("account.credentialsDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <AccountCredentialsPanel
                  businessId={access.businessId}
                  userEmail={access.userEmail}
                  isOwner={access.isOwner}
                  variant="embedded"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </PageShell>
    </AppShell>
  )
}
