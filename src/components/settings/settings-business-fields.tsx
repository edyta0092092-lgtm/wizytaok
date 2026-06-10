"use client"

import { BusinessAddressAutocomplete } from "@/components/forms/business-address-autocomplete"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSettingsFormContext } from "@/lib/settings/settings-form-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type SettingsBusinessFieldsProps = {
  className?: string
}

export function SettingsBusinessFields({ className }: SettingsBusinessFieldsProps) {
  const { t } = useTranslations()
  const {
    form,
    setForm,
    taxIdFieldError,
    addressSaveError,
    setAddressSaveError,
    setTaxIdEmptySaveError,
  } = useSettingsFormContext()

  return (
    <div className={cn("grid min-w-0 gap-4 sm:grid-cols-2", className)}>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="businessName">{t("settings.businessNameLabel")}</Label>
        <Input
          id="businessName"
          autoComplete="organization"
          value={form.businessName}
          onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
          placeholder={t("settings.placeholderBusinessExample")}
          className="h-11 rounded-xl"
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="businessAddress">{t("settings.businessAddressLabel")}</Label>
        <BusinessAddressAutocomplete
          id="businessAddress"
          value={form.businessAddress}
          placeId={form.businessAddressPlaceId}
          onValueChange={(businessAddress) => setForm((f) => ({ ...f, businessAddress }))}
          onPlaceIdChange={(businessAddressPlaceId) =>
            setForm((f) => ({ ...f, businessAddressPlaceId }))
          }
          onPlaceSelected={() => setAddressSaveError(false)}
          placeholder={t("settings.businessAddressPlaceholder")}
          pickFromListHint={t("settings.businessAddressPickFromList")}
          manualEntryHint={t("settings.businessAddressManualHint")}
          mapsLoadErrorHint={t("settings.businessAddressMapsError")}
        />
        {addressSaveError ? (
          <p className="text-xs text-destructive">{t("settings.businessAddressRequired")}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("settings.businessAddressHint")}</p>
        )}
      </div>
      <InternationalPhoneFieldGroup
        className="sm:col-span-2"
        label={t("settings.phoneLabel")}
        dialCode={form.phoneDialCode}
        nationalDigits={form.phoneNational}
        onDialCodeChange={(v) => setForm((f) => ({ ...f, phoneDialCode: v }))}
        onNationalChange={(digits) => setForm((f) => ({ ...f, phoneNational: digits }))}
        dialSelectId="settings-phone-dial"
        nationalInputId="settings-phone-national"
      />
      <div className="space-y-2 sm:col-span-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <Label htmlFor="tax-id" className={cn(!form.taxIdEntryEnabled && "text-muted-foreground")}>
            {t("settings.taxIdLabel")}
          </Label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:shrink-0">
            <input
              type="checkbox"
              checked={form.taxIdEntryEnabled}
              onChange={(e) => {
                const on = e.target.checked
                setTaxIdEmptySaveError(false)
                setForm((f) => ({
                  ...f,
                  taxIdEntryEnabled: on,
                  taxId: on ? f.taxId : "",
                }))
              }}
              className="size-4 shrink-0 rounded border border-input bg-background accent-primary"
            />
            <span>{t("settings.taxIdProvideToggle")}</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{t("settings.taxIdHint")}</p>
        <Input
          id="tax-id"
          autoComplete="off"
          value={form.taxId}
          onChange={(e) => {
            setTaxIdEmptySaveError(false)
            setForm((f) => ({ ...f, taxId: e.target.value }))
          }}
          placeholder={t("settings.taxIdPlaceholder")}
          disabled={!form.taxIdEntryEnabled}
          aria-invalid={Boolean(taxIdFieldError)}
          className={cn(
            "h-11 rounded-xl",
            !form.taxIdEntryEnabled && "opacity-60",
            taxIdFieldError ? "border-destructive focus-visible:ring-destructive/30" : null,
          )}
        />
        {taxIdFieldError ? (
          <p className="text-xs text-destructive" role="alert">
            {taxIdFieldError}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">{t("settings.emailLabel")}</Label>
        <Input
          id="settings-email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="kontakt@twojadomena.pl"
          className="h-11 rounded-xl"
        />
      </div>
    </div>
  )
}
