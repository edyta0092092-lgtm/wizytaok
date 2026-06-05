"use client"

import * as React from "react"
import Link from "next/link"

import { GuideHero } from "@/components/guide/guide-hero"
import { GuideReferencePanel } from "@/components/guide/guide-reference-panel"
import { GuideRoleOverview } from "@/components/guide/guide-role-overview"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { HELP_CENTER_FAQ_KEYS } from "@/lib/guide/help-center-sections"
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
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 sm:gap-12">
          <GuideHero
            badge={t("guide.helpCenterBadge")}
            title={t("guide.helpCenterTitle")}
            description={t("guide.helpCenterDescription")}
            subtitle={t("guide.helpCenterSubtitle")}
          />

          {isAdmin ? (
            <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {t("guide.helpCenterSetupNote")}{" "}
              <Link
                href="/dashboard"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("guide.helpCenterSetupLink")}
              </Link>
            </p>
          ) : (
            <p className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {t("guide.helpCenterStaffSetupNote")}
            </p>
          )}

          <GuideRoleOverview
            isAdmin={isAdmin}
            staffTitle={t("guide.roleOverviewStaffTitle")}
            staffLead={t("guide.roleOverviewStaffLead")}
            staffCanTitle={t("guide.roleOverviewStaffCanTitle")}
            staffCanBody={t("guide.roleOverviewStaffCanBody")}
            staffCannotTitle={t("guide.roleOverviewStaffCannotTitle")}
            staffCannotBody={t("guide.roleOverviewStaffCannotBody")}
            adminTitle={t("guide.roleOverviewAdminTitle")}
            adminLead={t("guide.roleOverviewAdminLead")}
            adminExtraTitle={t("guide.roleOverviewAdminExtraTitle")}
            adminExtraBody={t("guide.roleOverviewAdminExtraBody")}
            adminSectionAnchorLabel={t("guide.roleOverviewAdminAnchor")}
          />

          <GuideReferencePanel
            searchPlaceholder={t("guide.moduleSearchPlaceholder")}
            labelBullets={t("guide.labelBullets")}
            labelSteps={t("guide.labelSteps")}
            labelTip={t("guide.labelTip")}
            t={t}
            bookingPath={bookingPath}
            isAdmin={isAdmin}
          />

          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("guide.faqTitle")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {HELP_CENTER_FAQ_KEYS.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl border border-border/60 bg-muted/15 p-4"
                >
                  <summary className="cursor-pointer list-none text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span>{t(faq.q)}</span>
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(faq.a)}</p>
                </details>
              ))}
            </div>
          </section>

          <p className="pb-6 text-center text-sm text-muted-foreground">
            <Link href="/help" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("guide.navHelp")}
            </Link>
          </p>
        </div>
      </PageShell>
    </AppShell>
  )
}
