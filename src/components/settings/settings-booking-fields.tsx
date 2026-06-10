"use client"

import { BookingSlugSettingsFields } from "@/components/settings/booking-slug-settings-fields"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSettingsFormContext } from "@/lib/settings/settings-form-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  DEFAULT_BREAK_MINUTES_NONE_VALUE,
  formatServiceBreakMinutesOption,
  SERVICE_BREAK_MINUTES_OPTIONS,
} from "@/lib/services/service-break-options"
import { cn } from "@/lib/utils"

type SettingsBookingFieldsProps = {
  className?: string
}

export function SettingsBookingFields({ className }: SettingsBookingFieldsProps) {
  const { t } = useTranslations()
  const { form, setForm, savedPublicSlug } = useSettingsFormContext()

  return (
    <div className={cn("grid gap-4", className)}>
      <BookingSlugSettingsFields
        value={form.publicSlug}
        savedSlug={savedPublicSlug}
        onChange={(publicSlug) => setForm((f) => ({ ...f, publicSlug }))}
      />
      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="default-break-minutes">{t("settings.defaultBreakMinutesLabel")}</Label>
        <Select
          value={form.defaultBreakMinutes}
          onValueChange={(value) => setForm((f) => ({ ...f, defaultBreakMinutes: value }))}
        >
          <SelectTrigger id="default-break-minutes" className="h-11 w-full rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_BREAK_MINUTES_NONE_VALUE}>
              {t("settings.defaultBreakMinutesNone")}
            </SelectItem>
            {SERVICE_BREAK_MINUTES_OPTIONS.map((minutes) => (
              <SelectItem key={minutes} value={formatServiceBreakMinutesOption(minutes)}>
                {formatServiceBreakMinutesOption(minutes)} {t("services.min")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{t("settings.defaultBreakMinutesHint")}</p>
      </div>
    </div>
  )
}
