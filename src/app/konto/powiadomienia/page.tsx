"use client"

import * as React from "react"

import { ClientNotificationsView } from "@/components/client-portal/client-notifications-view"
import { useClientPortalWorkspace } from "@/lib/client-portal/use-client-portal-workspace"
import { getBrowserClient } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function KontoPowiadomieniaPage() {
  const { t } = useTranslations()
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    void getBrowserClient()?.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const { loading, lastSms, lastEmail } = useClientPortalWorkspace(userId)

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t("clientPortal.loading")}</p>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">{t("clientPortal.notificationsTitle")}</h2>
      <p className="text-xs text-muted-foreground">{t("clientPortal.notificationsLead")}</p>
      <ClientNotificationsView lastSms={lastSms} lastEmail={lastEmail} />
    </div>
  )
}
