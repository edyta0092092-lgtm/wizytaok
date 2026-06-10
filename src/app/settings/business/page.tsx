"use client"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { SettingsBusinessFields } from "@/components/settings/settings-business-fields"
import { SettingsDesktopRedirect } from "@/components/settings/settings-desktop-redirect"
import { SettingsMobileSubpage } from "@/components/settings/settings-mobile-subpage"
import { useTranslations } from "@/lib/i18n/use-translations"

export default function SettingsBusinessPage() {
  const { t } = useTranslations()

  return (
    <AppShell title={t("settings.mobileSectionBusiness")} pageDescription={t("settings.businessCardDesc")}>
      <PageShell>
        <SettingsDesktopRedirect />
        <SettingsMobileSubpage
          titleKey="settings.mobileSectionBusiness"
          descriptionKey="settings.businessCardDesc"
        >
          <SettingsBusinessFields />
        </SettingsMobileSubpage>
      </PageShell>
    </AppShell>
  )
}
