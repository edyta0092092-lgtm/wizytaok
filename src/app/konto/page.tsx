"use client"

import * as React from "react"

import { ClientPortalDashboardView } from "@/components/client-portal/client-portal-dashboard-view"
import { Card, CardContent } from "@/components/ui/card"
import { useClientPortalWorkspace } from "@/lib/client-portal/use-client-portal-workspace"
import { getBrowserClient } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function KontoDashboardPage() {
  const { t } = useTranslations()
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    void getBrowserClient()?.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const { loading, error, dashboard } = useClientPortalWorkspace(userId)

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("clientPortal.loading")}</p>
  }

  if (error || !dashboard) {
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {t("clientPortal.loadError")}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border border-dashed border-border shadow-none">
        <CardContent className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {t("clientPortal.foundationNotice")}
        </CardContent>
      </Card>
      <ClientPortalDashboardView dashboard={dashboard} />
    </div>
  )
}
