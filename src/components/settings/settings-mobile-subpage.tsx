"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { MobileFixedActionBar } from "@/components/mobile/mobile-fixed-action-bar"
import { Button } from "@/components/ui/button"
import { useSettingsFormContext } from "@/lib/settings/settings-form-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { scrollFocusedFieldIntoView } from "@/lib/mobile/scroll-focused-field-into-view"
import { SettingsSaveAlerts } from "@/components/settings/settings-save-alerts"

type SettingsMobileSubpageProps = {
  titleKey: string
  descriptionKey?: string
  children: React.ReactNode
  showSave?: boolean
}

export function SettingsMobileSubpage({
  titleKey,
  descriptionKey,
  children,
  showSave = true,
}: SettingsMobileSubpageProps) {
  const { t } = useTranslations()
  const { saving, settingsSaveBlocked, saveAll } = useSettingsFormContext()

  return (
    <div
      className="flex flex-col gap-4 pb-mobile-sticky-page lg:hidden"
      onFocusCapture={(e) => scrollFocusedFieldIntoView(e.target)}
    >
      <Button variant="ghost" size="sm" className="h-10 w-fit touch-manipulation rounded-xl" asChild>
        <Link href="/settings">
          <ArrowLeft className="mr-1.5 size-4" aria-hidden />
          {t("settings.mobileBackToList")}
        </Link>
      </Button>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t(titleKey)}</h1>
        {descriptionKey ? (
          <p className="text-sm text-muted-foreground">{t(descriptionKey)}</p>
        ) : null}
      </header>

      <SettingsSaveAlerts />

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm shadow-slate-900/5">
        {children}
      </div>

      {showSave ? (
        <MobileFixedActionBar>
          <Button
            type="button"
            className="h-11 w-full touch-manipulation rounded-xl"
            disabled={saving || settingsSaveBlocked}
            onClick={() => void saveAll()}
          >
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </MobileFixedActionBar>
      ) : null}
    </div>
  )
}
