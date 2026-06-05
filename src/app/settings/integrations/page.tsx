"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { GoogleCalendarCard } from "@/components/integrations/google-calendar-card"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { AccessDenied } from "@/components/shared/access-denied"
import { Button } from "@/components/ui/button"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function SettingsIntegrationsPage() {
  const { t } = useTranslations()
  const { ready, canManageSettings } = useBusinessAccess()

  if (ready && !canManageSettings) {
    return (
      <AppShell
        title={t("googleCalendarIntegration.pageTitle")}
        pageDescription={t("googleCalendarIntegration.pageDescription")}
      >
        <PageShell>
          <AccessDenied />
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={t("googleCalendarIntegration.pageTitle")}
      pageDescription={t("googleCalendarIntegration.pageDescription")}
    >
      <PageShell>
        <div className="mb-4">
          <Button variant="ghost" size="sm" className="h-9 rounded-xl px-2" asChild>
            <Link href="/settings">
              <ArrowLeft className="mr-1.5 size-4" aria-hidden />
              {t("googleCalendarIntegration.backToSettings")}
            </Link>
          </Button>
        </div>
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t("googleCalendarIntegration.pageHeading")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("googleCalendarIntegration.pageLead")}
            </p>
          </div>
          <React.Suspense fallback={null}>
            <GoogleCalendarCard />
          </React.Suspense>
        </div>
      </PageShell>
    </AppShell>
  )
}
