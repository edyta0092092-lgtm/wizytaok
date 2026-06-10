"use client"

import * as React from "react"

import { BillingRequiredSettingsBanner } from "@/components/billing/billing-required-settings-banner"
import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { SettingsDesktopRedirect } from "@/components/settings/settings-desktop-redirect"
import { SettingsMobileSubpage } from "@/components/settings/settings-mobile-subpage"
import { TestBillingSettingsCard } from "@/components/settings/test-billing-settings-card"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function SettingsSubscriptionPage() {
  const { t } = useTranslations()
  const [showBillingRequiredBanner, setShowBillingRequiredBanner] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const billing = new URLSearchParams(window.location.search).get("billing")
    queueMicrotask(() => {
      setShowBillingRequiredBanner(billing === "required")
    })
  }, [])

  return (
    <AppShell
      title={t("settings.mobileSectionSubscription")}
      pageDescription={t("settings.testBillingLead")}
    >
      <PageShell>
        <SettingsDesktopRedirect />
        <SettingsMobileSubpage
          titleKey="settings.mobileSectionSubscription"
          descriptionKey="settings.testBillingLead"
          showSave={false}
        >
          <div className="space-y-4">
            {showBillingRequiredBanner ? <BillingRequiredSettingsBanner /> : null}
            <TestBillingSettingsCard />
          </div>
        </SettingsMobileSubpage>
      </PageShell>
    </AppShell>
  )
}
