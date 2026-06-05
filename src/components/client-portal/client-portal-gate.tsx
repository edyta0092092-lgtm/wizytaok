"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { isClientAccountUser } from "@/lib/client-portal/client-portal-auth"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ClientPortalGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslations()
  const router = useRouter()
  const [state, setState] = React.useState<"loading" | "ready" | "redirect">("loading")

  React.useEffect(() => {
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setState("redirect"))
      router.replace("/konto/logowanie")
      return
    }
    const client = getBrowserClient()
    if (!client) {
      queueMicrotask(() => setState("redirect"))
      router.replace("/konto/logowanie")
      return
    }
    void client.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setState("redirect")
        router.replace("/konto/logowanie")
        return
      }
      if (!isClientAccountUser(user)) {
        setState("redirect")
        router.replace("/konto/logowanie?error=client_account_required")
        return
      }
      setState("ready")
    })
  }, [router])

  if (state !== "ready") {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("clientPortal.loading")}
      </p>
    )
  }

  return <>{children}</>
}
