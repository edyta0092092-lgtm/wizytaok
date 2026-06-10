"use client"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { SettingsBookingFields } from "@/components/settings/settings-booking-fields"
import { SettingsDesktopRedirect } from "@/components/settings/settings-desktop-redirect"
import { SettingsMobileSubpage } from "@/components/settings/settings-mobile-subpage"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function SettingsBookingPage() {
  const { t } = useTranslations()

  return (
    <AppShell
      title={t("settings.mobileSectionBooking")}
      pageDescription={t("settings.onlineBookingDesc")}
    >
      <PageShell>
        <SettingsDesktopRedirect />
        <SettingsMobileSubpage
          titleKey="settings.mobileSectionBooking"
          descriptionKey="settings.onlineBookingDesc"
        >
          <SettingsBookingFields />
        </SettingsMobileSubpage>
      </PageShell>
    </AppShell>
  )
}
