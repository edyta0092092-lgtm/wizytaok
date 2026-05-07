"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import {
  formatPhoneCountryOptionLabel,
  PHONE_COUNTRY_OPTIONS,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"

export type InternationalPhoneFieldGroupProps = {
  label: React.ReactNode
  dialCode: string
  nationalDigits: string
  onDialCodeChange: (dialCode: string) => void
  onNationalChange: (digits: string) => void
  dialSelectId: string
  nationalInputId: string
  nationalPlaceholder?: string
  nationalInputAriaLabel?: string
  disabled?: boolean
  className?: string
  /** Gdy false — tylko layout i walidacja wizualna (obramowanie) bez tekstu błędu (np. komunikat jest gdzie indziej). */
  showInlineError?: boolean
}

export function InternationalPhoneFieldGroup({
  label,
  dialCode,
  nationalDigits,
  onDialCodeChange,
  onNationalChange,
  dialSelectId,
  nationalInputId,
  nationalPlaceholder,
  nationalInputAriaLabel,
  disabled,
  className,
  showInlineError = true,
}: InternationalPhoneFieldGroupProps) {
  const { t } = useTranslations()
  const phoneNationalError = React.useMemo(() => {
    const v = validateNationalPhoneLength(dialCode, nationalDigits)
    if (v.ok) return null
    if (v.min === v.max) {
      return t("settings.phoneInvalidNationalLengthExact").replace("{n}", String(v.min))
    }
    return t("settings.phoneInvalidNationalLength")
      .replace("{min}", String(v.min))
      .replace("{max}", String(v.max))
  }, [dialCode, nationalDigits, t])

  const ph = nationalPlaceholder ?? t("settings.phoneNationalPlaceholder")
  const ariaNat = nationalInputAriaLabel ?? ph

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={nationalInputId}>{label}</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="w-full sm:w-24 sm:shrink-0">
          <Select value={dialCode} onValueChange={onDialCodeChange} disabled={disabled}>
            <SelectTrigger
              id={dialSelectId}
              aria-label={t("settings.phoneDialAria")}
              className="h-11 min-w-0 w-full rounded-xl"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHONE_COUNTRY_OPTIONS.map((opt) => (
                <SelectItem key={opt.dialCode} value={opt.dialCode}>
                  {formatPhoneCountryOptionLabel(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            id={nationalInputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            aria-label={ariaNat}
            value={nationalDigits}
            onChange={(e) => onNationalChange(e.target.value.replace(/\D/g, ""))}
            placeholder={ph}
            aria-invalid={Boolean(phoneNationalError)}
            disabled={disabled}
            className={cn(
              "h-11 rounded-xl",
              phoneNationalError ? "border-destructive aria-invalid:border-destructive" : null,
            )}
          />
        </div>
      </div>
      {showInlineError && phoneNationalError ? (
        <p className="text-xs text-destructive" role="alert">
          {phoneNationalError}
        </p>
      ) : null}
    </div>
  )
}
