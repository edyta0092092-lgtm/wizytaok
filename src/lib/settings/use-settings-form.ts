"use client"

import * as React from "react"
import { toast } from "sonner"

import { saveBusinessProfileAction } from "@/app/settings/business-profile-actions"
import { markPanelAccessJustActivated } from "@/lib/tour/tour-access-activation"
import {
  isBusinessAddressEntryValid,
  normalizeBusinessAddress,
} from "@/lib/business/business-address"
import { businessAddressRequiresPlaceId } from "@/components/forms/business-address-autocomplete"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import {
  buildStoredInternationalPhone,
  splitStoredPhoneIntoParts,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"
import {
  formatDefaultBreakMinutesFormValue,
  normalizeDefaultBreakMinutesFormValue,
  parseDefaultBreakMinutesFormValue,
} from "@/lib/services/service-break-options"
import {
  demoSettings,
  emptySettings,
  SETTINGS_STORAGE_KEY,
  type SettingsForm,
} from "@/lib/settings/settings-form-types"

function initialSettingsForm(): SettingsForm {
  return isSupabaseConfigured() ? { ...emptySettings } : { ...demoSettings }
}

export function useSettingsForm(businessId: string | null | undefined, oauthBusinessSetup: boolean) {
  const { t } = useTranslations()
  const [form, setForm] = React.useState<SettingsForm>(initialSettingsForm)
  const [savedPublicSlug, setSavedPublicSlug] = React.useState("")
  const [showSaved, setShowSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [taxIdEmptySaveError, setTaxIdEmptySaveError] = React.useState(false)
  const [addressSaveError, setAddressSaveError] = React.useState(false)

  const stripeReturnHandledRef = React.useRef(false)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const stripeTest = params.get("stripe_test")
    const stripePaid = params.get("stripe_paid")
    const portalReturn = params.get("portal")
    if (portalReturn === "return") {
      if (stripeReturnHandledRef.current) return
      stripeReturnHandledRef.current = true
      toast.success(t("access.portalReturnNotice"))
      return
    }
    const p = stripePaid ?? stripeTest
    if (p !== "success" && p !== "cancel") return
    if (stripeReturnHandledRef.current) return
    stripeReturnHandledRef.current = true
    if (p === "success") {
      if (businessId) {
        markPanelAccessJustActivated(businessId)
      }
      if (stripePaid === "success") {
        toast.success(t("access.activatePaymentProcessing"))
      } else {
        toast.success(t("settings.testBillingSuccess"))
      }
    } else {
      toast(t("settings.testBillingCancel"))
    }
  }, [t, businessId])

  const taxIdDigitsHint = React.useMemo(() => {
    if (!form.taxIdEntryEnabled) return null
    const compact = form.taxId.replace(/[\s-]/g, "").trim()
    if (!compact) return null
    if (!/^\d+$/.test(compact)) return t("settings.taxIdDigitsHint")
    if (compact.length !== 10) return t("settings.taxIdDigitsHint")
    if (!isPolishNip10Valid(compact)) return t("settings.taxIdInvalidChecksum")
    return null
  }, [form.taxId, form.taxIdEntryEnabled, t])

  const taxIdFieldError =
    taxIdDigitsHint ?? (taxIdEmptySaveError ? t("settings.taxIdRequiredOrUncheck") : null)

  const phoneNationalError = React.useMemo(() => {
    const v = validateNationalPhoneLength(form.phoneDialCode, form.phoneNational)
    if (v.ok) return null
    if (v.min === v.max) {
      return t("settings.phoneInvalidNationalLengthExact").replace("{n}", String(v.min))
    }
    return t("settings.phoneInvalidNationalLength")
      .replace("{min}", String(v.min))
      .replace("{max}", String(v.max))
  }, [form.phoneDialCode, form.phoneNational, t])

  const settingsSaveBlocked = Boolean(taxIdDigitsHint || phoneNationalError)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (oauthBusinessSetup || isSupabaseConfigured()) return
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsForm> & { phone?: string; ownerName?: string }
        const { phone: legacyPhone, ownerName, ...rest } = parsed
        void ownerName
        const fromStorage: Partial<SettingsForm> = { ...rest }
        if (
          typeof legacyPhone === "string" &&
          fromStorage.phoneDialCode === undefined &&
          fromStorage.phoneNational === undefined
        ) {
          const parts = splitStoredPhoneIntoParts(legacyPhone)
          fromStorage.phoneDialCode = parts.dialCode
          fromStorage.phoneNational = parts.nationalDigits
        }
        if (fromStorage.taxIdEntryEnabled === undefined) {
          const tid =
            typeof fromStorage.taxId === "string" ? fromStorage.taxId.replace(/[\s-]/g, "").trim() : ""
          fromStorage.taxIdEntryEnabled = tid.length > 0
        }
        fromStorage.defaultBreakMinutes = normalizeDefaultBreakMinutesFormValue(
          fromStorage.defaultBreakMinutes,
        )
        queueMicrotask(() => {
          setForm((prev) => ({ ...prev, ...fromStorage }))
        })
      }
    } catch {
      // ignore
    }
  }, [oauthBusinessSetup])

  React.useEffect(() => {
    if (!isSupabaseConfigured()) return
    const client = getBrowserClient()
    if (!client) return
    let cancelled = false
    void client.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return
      void client
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data || cancelled) return
          const pickString = (...vals: unknown[]) => {
            for (const v of vals) {
              if (typeof v === "string" && v.trim().length > 0) return v
            }
            return ""
          }
          const taxIdFromDb = pickString(data.tax_id, data.company_tax_id)
          const phoneFromDb = pickString(data.phone, data.contact_phone)
          const phoneParts = splitStoredPhoneIntoParts(phoneFromDb)
          setForm((f) => ({
            ...f,
            businessName: data.business_name,
            businessAddress:
              typeof data.business_address === "string" ? data.business_address : "",
            businessAddressPlaceId:
              typeof data.business_address_place_id === "string"
                ? data.business_address_place_id
                : "",
            publicSlug: data.slug,
            email: data.email ?? user.email ?? f.email,
            phoneDialCode: phoneParts.dialCode,
            phoneNational: phoneParts.nationalDigits,
            taxId: taxIdFromDb,
            taxIdEntryEnabled: taxIdFromDb.replace(/[\s-]/g, "").trim().length > 0,
            defaultBreakMinutes: formatDefaultBreakMinutesFormValue(
              data.default_break_minutes != null && Number.isFinite(Number(data.default_break_minutes))
                ? Number(data.default_break_minutes)
                : null,
            ),
          }))
          setSavedPublicSlug(typeof data.slug === "string" ? data.slug : "")
        })
    })
    return () => {
      cancelled = true
    }
  }, [businessId])

  React.useEffect(() => {
    if (!showSaved) return
    const tid = window.setTimeout(() => setShowSaved(false), 4500)
    return () => window.clearTimeout(tid)
  }, [showSaved])

  function normalizeTaxIdPayload(raw: string): string | null {
    const s = raw.replace(/[\s-]/g, "").trim()
    return s.length > 0 ? s : null
  }

  const saveAll = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setSaveError(null)
    setTaxIdEmptySaveError(false)
    setAddressSaveError(false)
    const taxForSave = form.taxIdEntryEnabled ? normalizeTaxIdPayload(form.taxId) : null
    if (form.taxIdEntryEnabled && taxForSave === null) {
      setTaxIdEmptySaveError(true)
      return
    }
    if (form.taxIdEntryEnabled && taxForSave !== null && !isPolishNip10Valid(taxForSave)) {
      setSaveError(t("settings.taxIdInvalidChecksum"))
      return
    }
    const addressNormalized = normalizeBusinessAddress(form.businessAddress)
    if (
      !isBusinessAddressEntryValid(addressNormalized, form.businessAddressPlaceId, {
        requirePlaceId: businessAddressRequiresPlaceId(),
      })
    ) {
      setAddressSaveError(true)
      setSaveError(
        !addressNormalized
          ? t("settings.businessAddressRequired")
          : t("settings.businessAddressPickFromList"),
      )
      return
    }
    const pv = validateNationalPhoneLength(form.phoneDialCode, form.phoneNational)
    if (!pv.ok) {
      setSaveError(
        pv.min === pv.max
          ? t("settings.phoneInvalidNationalLengthExact").replace("{n}", String(pv.min))
          : t("settings.phoneInvalidNationalLength")
              .replace("{min}", String(pv.min))
              .replace("{max}", String(pv.max)),
      )
      return
    }
    setSaving(true)
    try {
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(form))
      } catch {
        // ignore
      }

      if (isSupabaseConfigured()) {
        const result = await saveBusinessProfileAction({
          businessName: form.businessName,
          businessAddress: addressNormalized,
          businessAddressPlaceId: form.businessAddressPlaceId.trim(),
          slug: form.publicSlug,
          email: form.email,
          phone: buildStoredInternationalPhone(form.phoneDialCode, form.phoneNational),
          taxId: form.taxIdEntryEnabled ? normalizeTaxIdPayload(form.taxId) : null,
        })
        if (!result.ok) {
          if (result.code === "unauthorized") {
            setShowSaved(true)
            return
          }
          if (result.code === "slug_taken") {
            setSaveError(t("auth.slugTaken"))
            return
          }
          if (result.code === "slug_invalid") {
            setSaveError(t("auth.slugInvalid"))
            return
          }
          if (result.code === "tax_id_invalid") {
            setSaveError(t("settings.taxIdInvalidChecksum"))
            return
          }
          if (result.code === "tax_id_taken") {
            setSaveError(t("auth.taxIdTaken"))
            return
          }
          if (result.code === "phone_taken") {
            setSaveError(t("auth.phoneTaken"))
            return
          }
          if (result.code === "email_taken") {
            setSaveError(t("auth.emailTaken"))
            return
          }
          if (result.code === "missing_business_address") {
            setAddressSaveError(true)
            setSaveError(t("settings.businessAddressRequired"))
            return
          }
          if (result.code === "invalid_business_address") {
            setAddressSaveError(true)
            setSaveError(t("settings.businessAddressPickFromList"))
            return
          }
          const fallbackError =
            process.env.NODE_ENV === "development" && result.details
              ? `${t("common.saveError")} ${t("help.errorDetailsPrefix")} ${result.details}`
              : t("common.saveError")
          setSaveError(fallbackError)
          return
        }

        const breakValue = parseDefaultBreakMinutesFormValue(form.defaultBreakMinutes)
        const breakClient = getBrowserClient()
        const breakUser = breakClient ? (await breakClient.auth.getUser()).data.user : null
        if (breakClient && breakUser) {
          const { error: breakError } = await breakClient
            .from("business_profiles")
            .update({ default_break_minutes: breakValue })
            .eq("owner_id", breakUser.id)
          if (breakError) {
            const missingColumn = String(breakError.message ?? "").includes("default_break_minutes")
            if (!missingColumn) {
              setSaveError(t("common.saveError"))
              return
            }
          }
        }
      }

      setShowSaved(true)
      setSavedPublicSlug(form.publicSlug.trim())
    } finally {
      setSaving(false)
    }
  }

  return {
    form,
    setForm,
    savedPublicSlug,
    showSaved,
    saveError,
    saving,
    taxIdEmptySaveError,
    setTaxIdEmptySaveError,
    addressSaveError,
    setAddressSaveError,
    taxIdFieldError,
    phoneNationalError,
    settingsSaveBlocked,
    saveAll,
  }
}
