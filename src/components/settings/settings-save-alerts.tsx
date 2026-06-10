"use client"

import { Check } from "lucide-react"

import { useSettingsFormContext } from "@/lib/settings/settings-form-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export function SettingsSaveAlerts() {
  const { t } = useTranslations()
  const { saveError, showSaved } = useSettingsFormContext()

  if (!saveError && !showSaved) return null

  return (
    <div className="space-y-3">
      {saveError ? (
        <div
          role="status"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm shadow-slate-900/5"
        >
          {saveError}
        </div>
      ) : null}
      {showSaved ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground shadow-sm shadow-slate-900/5"
        >
          <Check className="size-4 shrink-0 text-success" aria-hidden />
          {t("settings.savedBanner")}
        </div>
      ) : null}
    </div>
  )
}
