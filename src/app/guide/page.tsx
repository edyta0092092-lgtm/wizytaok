"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen, RotateCcw } from "lucide-react"

import { GuideHero } from "@/components/guide/guide-hero"
import { GuideReferencePanel } from "@/components/guide/guide-reference-panel"
import { GuideRoleOverview } from "@/components/guide/guide-role-overview"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { HELP_CENTER_FAQ_KEYS } from "@/lib/guide/help-center-sections"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export default function GuidePage() {
  const { t } = useTranslations()
  const { restartOnboarding } = useOnboarding()
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
            startTourLabel={t("onboarding.restart")}
            onStartTour={() => restartOnboarding()}
            tourTargetId="guide-intro"
          />

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">{t("guide.helpCenterSetupNote")}</span>
              <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => restartOnboarding()}>
                <RotateCcw className="size-3.5" />
                {t("onboarding.restart")}
              </Button>
            </div>
          ) : (
            <p className="rounded-2xl border border-border/80 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
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
                  className="group rounded-2xl border border-border/60 bg-muted/20 p-4 dark:bg-muted/10"
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
