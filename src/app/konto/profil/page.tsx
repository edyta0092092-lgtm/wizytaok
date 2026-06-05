"use client"

import * as React from "react"

import { ClientProfileForm } from "@/components/client-portal/client-profile-form"
import { useClientPortalWorkspace } from "@/lib/client-portal/use-client-portal-workspace"
import { getBrowserClient } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function KontoProfilPage() {
  const { t } = useTranslations()
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    void getBrowserClient()?.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const { loading, profile, saveProfile } = useClientPortalWorkspace(userId)

  if (loading || !profile) {
    return <p className="text-sm text-muted-foreground">{t("clientPortal.loading")}</p>
  }

  return <ClientProfileForm profile={profile} onSave={saveProfile} />
}
