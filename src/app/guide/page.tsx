"use client"

import * as React from "react"

import { HelpCenterHub } from "@/components/guide/help-center-hub"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export default function GuidePage() {
  const { t } = useTranslations()
  const { businessId, effectiveRole } = useBusinessAccess()
  const isAdmin = effectiveRole === "admin"
  const [bookingSlug, setBookingSlug] = React.useState("")

  React.useEffect(() => {
    if (!businessId || !isSupabaseConfigured()) return
    let cancelled = false
    const client = getBrowserClient()
    if (!client) return
    void (async () => {
      const { data } = await client
        .from("business_profiles")
        .select("slug")
        .eq("id", businessId)
        .maybeSingle()
      if (!cancelled && typeof data?.slug === "string" && data.slug.trim()) {
        setBookingSlug(data.slug.trim())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  const bookingPath = bookingSlug ? `/rezerwacje/${bookingSlug}` : "/settings"

  return (
    <AppShell title={t("guide.helpCenterTitle")} pageDescription={t("guide.helpCenterDescription")}>
      <PageShell>
        <div className="mx-auto w-full max-w-[1100px]">
          <HelpCenterHub t={t} bookingPath={bookingPath} isAdmin={isAdmin} />
        </div>
      </PageShell>
    </AppShell>
  )
}
