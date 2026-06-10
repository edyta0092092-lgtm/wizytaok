"use client"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { SettingsDesktopRedirect } from "@/components/settings/settings-desktop-redirect"
import { SettingsMobileNotificationsLinks } from "@/components/settings/settings-mobile-notifications-links"
import { SettingsMobileSubpage } from "@/components/settings/settings-mobile-subpage"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function SettingsNotificationsPage() {
  const { t } = useTranslations()

  return (
    <AppShell
      title={t("settings.mobileSectionNotifications")}
      pageDescription={t("settings.mobileNotificationsDesc")}
    >
      <PageShell>
        <SettingsDesktopRedirect />
        <SettingsMobileSubpage
          titleKey="settings.mobileSectionNotifications"
          descriptionKey="settings.mobileNotificationsDesc"
          showSave={false}
        >
          <SettingsMobileNotificationsLinks />
        </SettingsMobileSubpage>
      </PageShell>
    </AppShell>
  )
}
