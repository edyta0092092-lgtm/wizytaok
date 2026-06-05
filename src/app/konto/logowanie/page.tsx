"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { ClientLoginForm } from "@/components/client-portal/client-login-form"
import { isClientAccountUser } from "@/lib/client-portal/client-portal-auth"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function KontoLogowaniePage() {
  const { t } = useTranslations()
  const router = useRouter()

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return
    void getBrowserClient()?.auth.getUser().then(({ data: { user } }) => {
      if (user && isClientAccountUser(user)) {
        router.replace("/konto")
      }
    })
  }, [router])

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto mb-6 max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">{t("clientPortal.portalTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("clientPortal.loginLead")}</p>
      </div>
      <React.Suspense fallback={null}>
        <ClientLoginForm />
      </React.Suspense>
    </div>
  )
}
