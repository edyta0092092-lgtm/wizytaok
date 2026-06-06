"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Download, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveBusinessProfileAction } from "@/app/settings/business-profile-actions"
import { BillingRequiredSettingsBanner } from "@/components/billing/billing-required-settings-banner"
import { BusinessOAuthSetupPanel } from "@/components/settings/business-oauth-setup-panel"
import { AccessDenied } from "@/components/shared/access-denied"
import { SettingsIntegrationsLinkCard } from "@/components/settings/settings-integrations-link-card"
import { TestBillingSettingsCard } from "@/components/settings/test-billing-settings-card"
import {
  BusinessAddressAutocomplete,
  businessAddressRequiresPlaceId,
} from "@/components/forms/business-address-autocomplete"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import {
  isBusinessAddressEntryValid,
  normalizeBusinessAddress,
} from "@/lib/business/business-address"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { markPanelAccessJustActivated } from "@/lib/tour/tour-access-activation"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { loadClientsWorkspace } from "@/lib/clients/clients-store"
import {
  buildAppointmentsCsv,
  buildClientsCsv,
  downloadCsvFile,
  type AppointmentCsvHeaders,
  type ClientCsvHeaders,
} from "@/lib/export/csv-export"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/lib/i18n/use-translations"
import { isPolishNip10Valid } from "@/lib/validation/polish-nip"
import {
  buildStoredInternationalPhone,
  splitStoredPhoneIntoParts,
  validateNationalPhoneLength,
} from "@/lib/validation/international-phone"
import {
  DEFAULT_BREAK_MINUTES_NONE_VALUE,
  formatDefaultBreakMinutesFormValue,
  formatServiceBreakMinutesOption,
  normalizeDefaultBreakMinutesFormValue,
  parseDefaultBreakMinutesFormValue,
  SERVICE_BREAK_MINUTES_OPTIONS,
} from "@/lib/services/service-break-options"
import type { AppointmentStatus } from "@/types/domain"

const SETTINGS_STORAGE_KEY = "pw_settings_form_v2"

type SettingsForm = {
  businessName: string
  businessAddress: string
  businessAddressPlaceId: string
  publicSlug: string
  email: string
  phoneDialCode: string
  phoneNational: string
  taxId: string
  taxIdEntryEnabled: boolean
  depositForNewClients: boolean
  depositForAllClients: boolean
  depositAmount: string
  defaultBreakMinutes: string
}

const demoSettings: SettingsForm = {
  businessName: "Studio WizytaOK",
  businessAddress: "ul. Przykładowa 1, 00-001 Warszawa",
  businessAddressPlaceId: "",
  publicSlug: "rezerwacje",
  email: "kontakt@example.pl",
  phoneDialCode: "+48",
  phoneNational: "600000000",
  taxId: "",
  taxIdEntryEnabled: false,
  depositForNewClients: false,
  depositForAllClients: false,
  depositAmount: "50",
  defaultBreakMinutes: DEFAULT_BREAK_MINUTES_NONE_VALUE,
}

const emptySettings: SettingsForm = {
  businessName: "",
  businessAddress: "",
  businessAddressPlaceId: "",
  publicSlug: "",
  email: "",
  phoneDialCode: "+48",
  phoneNational: "",
  taxId: "",
  taxIdEntryEnabled: false,
  depositForNewClients: false,
  depositForAllClients: false,
  depositAmount: "",
  defaultBreakMinutes: DEFAULT_BREAK_MINUTES_NONE_VALUE,
}

function initialSettingsForm(): SettingsForm {
  return isSupabaseConfigured() ? { ...emptySettings } : { ...demoSettings }
}

function SettingsOnboardingCard() {
  const { t } = useTranslations()
  const { restartOnboarding, setupComplete } = useOnboarding()
  const title = setupComplete ? t("onboarding.reconfigure") : t("onboarding.restart")
  const hint = setupComplete ? t("onboarding.reconfigureHint") : t("onboarding.restartHint")

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          {hint}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-2 rounded-xl sm:w-auto"
          onClick={() => restartOnboarding()}
        >
          <RotateCcw className="size-4" />
          {title}
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const { t } = useTranslations()
  const [showBillingRequiredBanner, setShowBillingRequiredBanner] = React.useState(false)
  const [oauthBusinessSetup, setOauthBusinessSetup] = React.useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("setup") === "business"
  })
  const { ready, businessId, canManageSettings, isOwner, userEmail, refresh } = useBusinessAccess()

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const billing = params.get("billing")
    queueMicrotask(() => {
      setShowBillingRequiredBanner(billing === "required")
      setOauthBusinessSetup(params.get("setup") === "business")
    })
  }, [])
  const [form, setForm] = React.useState<SettingsForm>(initialSettingsForm)
  const [showSaved, setShowSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [exportBusy, setExportBusy] = React.useState<"appointments" | "clients" | null>(null)
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

  const taxIdFieldError = taxIdDigitsHint ?? (taxIdEmptySaveError ? t("settings.taxIdRequiredOrUncheck") : null)

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

  const statusLabelLookup = React.useCallback(
    (status: AppointmentStatus) =>
      t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked"),
    [t]
  )

  const exportAppointmentsCsv = () => {
    void (async () => {
      setExportBusy("appointments")
      try {
        const rows = await fetchMergedAppointments({ businessId: businessId ?? undefined })
        const headers: AppointmentCsvHeaders = {
          date: t("settings.csvColDate"),
          time: t("settings.csvColTime"),
          client: t("settings.csvColClient"),
          phone: t("settings.csvColPhone"),
          email: t("settings.csvColEmail"),
          service: t("settings.csvColService"),
          status: t("settings.csvColStatus"),
          staff: t("settings.csvStaffCol"),
        }
        const csv = buildAppointmentsCsv(rows, headers, statusLabelLookup, t("team.anyStaff"))
        downloadCsvFile("wizytaok-wizyty.csv", csv)
      } finally {
        setExportBusy(null)
      }
    })()
  }

  const exportClientsCsv = () => {
    void (async () => {
      setExportBusy("clients")
      try {
        const { clients } = await loadClientsWorkspace({ businessId: businessId ?? undefined })
        const headers: ClientCsvHeaders = {
          fullName: t("settings.csvClientsName"),
          phone: t("settings.csvClientsPhone"),
          email: t("settings.csvClientsEmail"),
          notes: t("settings.csvClientsNotes"),
          visitCount: t("settings.csvClientsVisits"),
          confirmedVisits: t("settings.csvClientsConfirmed"),
          noShows: t("settings.csvClientsNoShows"),
        }
        downloadCsvFile("wizytaok-klienci.csv", buildClientsCsv(clients, headers))
      } finally {
        setExportBusy(null)
      }
    })()
  }

  function normalizeTaxIdPayload(raw: string): string | null {
    const s = raw.replace(/[\s-]/g, "").trim()
    return s.length > 0 ? s : null
  }

  const saveAll = async (e: React.FormEvent) => {
    e.preventDefault()
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
            // keep local-only save when user is not authenticated
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
    } finally {
      setSaving(false)
    }
  }

  if (ready && businessId && !canManageSettings) {
    return (
      <AppShell title={t("navigation.settings")} pageDescription={t("settings.description")}>
        <PageShell>
          <AccessDenied />
        </PageShell>
      </AppShell>
    )
  }

  const showOAuthSetupOnly = oauthBusinessSetup && ready && !businessId

  React.useEffect(() => {
    if (!oauthBusinessSetup || !ready || businessId) return
    void refresh()
  }, [oauthBusinessSetup, ready, businessId, refresh])

  if (showOAuthSetupOnly) {
    return (
      <AppShell
        title={t("navigation.settings")}
        pageDescription={t("auth.completeBusinessSetupToContinue")}
      >
        <PageShell>
          <BusinessOAuthSetupPanel
            onProfileSaved={() => {
              void refresh()
            }}
          />
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={t("navigation.settings")}
      pageDescription={t("settings.description")}
      primaryAction={
        <Button
          type="submit"
          form="settings-form"
          size="sm"
          className="h-10 rounded-xl px-4 text-sm"
          disabled={saving || settingsSaveBlocked}
        >
          {saving ? t("common.saving") : t("common.saveChanges")}
        </Button>
      }
    >
      <PageShell
      >
        {oauthBusinessSetup && ready && !businessId ? (
          <BusinessOAuthSetupPanel
            onProfileSaved={() => {
              void refresh()
            }}
          />
        ) : null}
        {showBillingRequiredBanner ? <BillingRequiredSettingsBanner /> : null}
        {saveError ? (
          <div
            role="status"
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm shadow-sm shadow-slate-900/5 ${
              "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {saveError}
          </div>
        ) : null}

        {showSaved ? (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground shadow-sm shadow-slate-900/5"
          >
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            {t("settings.savedBanner")}
          </div>
        ) : null}

        <form id="settings-form" onSubmit={(e) => void saveAll(e)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            {/* Lewa kolumna: dane firmy + eksport */}
            <div className="flex min-w-0 flex-col gap-6">
              <Card
                data-tour="settings-company"
                className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5"
              >
                <CardHeader className="border-b border-border/70 py-4">
                  <CardTitle className="text-sm font-semibold">{t("settings.business")}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("settings.businessCardDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid min-w-0 gap-4 pt-4 sm:grid-cols-2">
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
                      onValueChange={(businessAddress) =>
                        setForm((f) => ({ ...f, businessAddress }))
                      }
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
                  <div className="sm:col-span-2">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link
                        href={
                          form.publicSlug
                            ? `/rezerwacje?firma=${encodeURIComponent(form.publicSlug)}`
                            : "/rezerwacje"
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("settings.openBookingPage")}
                      </Link>
                    </Button>
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
                      <Label
                        htmlFor="tax-id"
                        className={cn(!form.taxIdEntryEnabled && "text-muted-foreground")}
                      >
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
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                <CardHeader className="border-b border-border/70 py-4">
                  <CardTitle className="text-sm font-semibold">
                    {t("settings.onlineBookingTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("settings.onlineBookingDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 pt-4">
                  <div className="space-y-1.5 sm:max-w-xs">
                    <Label htmlFor="default-break-minutes">
                      {t("settings.defaultBreakMinutesLabel")}
                    </Label>
                    <Select
                      value={form.defaultBreakMinutes}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, defaultBreakMinutes: value }))
                      }
                    >
                      <SelectTrigger id="default-break-minutes" className="h-11 w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={DEFAULT_BREAK_MINUTES_NONE_VALUE}>
                          {t("settings.defaultBreakMinutesNone")}
                        </SelectItem>
                        {SERVICE_BREAK_MINUTES_OPTIONS.map((minutes) => (
                          <SelectItem
                            key={minutes}
                            value={formatServiceBreakMinutesOption(minutes)}
                          >
                            {formatServiceBreakMinutesOption(minutes)} {t("services.min")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.defaultBreakMinutesHint")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                <CardHeader className="border-b border-border/70 py-4">
                  <CardTitle className="text-sm font-semibold">{t("settings.dataExportTitle")}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("settings.dataExportDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row sm:flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 justify-center gap-2 rounded-xl border-border/90"
                    disabled={Boolean(exportBusy)}
                    onClick={exportAppointmentsCsv}
                  >
                    <Download className="size-4 shrink-0" aria-hidden />
                    {exportBusy === "appointments" ? "..." : t("settings.exportAppointmentsCsvBtn")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 justify-center gap-2 rounded-xl border-border/90"
                    disabled={Boolean(exportBusy)}
                    onClick={exportClientsCsv}
                  >
                    <Download className="size-4 shrink-0" aria-hidden />
                    {exportBusy === "clients" ? "..." : t("settings.exportClientsCsvBtn")}
                  </Button>
                </CardContent>
              </Card>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>{t("settings.changesApplyAfterSave")}</p>
                <p>{t("settings.footerNote")}</p>
              </div>
            </div>

            {/* Prawa kolumna: subskrypcja, onboarding, informacje prawne */}
            <div className="flex min-w-0 flex-col gap-6">
              {canManageSettings ? <SettingsIntegrationsLinkCard /> : null}
              <TestBillingSettingsCard />

              <SettingsOnboardingCard />

              <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                <CardHeader className="border-b border-border/70 py-4">
                  <CardTitle className="text-sm font-semibold">
                    {t("settings.legalInfoTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    {t("settings.legalInfoDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 pt-4 sm:grid-cols-2 sm:gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 w-full justify-center rounded-xl border-border/90"
                  >
                    <Link href="/terms">{t("footer.terms")}</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 w-full justify-center rounded-xl border-border/90"
                  >
                    <Link href="/developer-contact">{t("footer.developer")}</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-11 w-full justify-center rounded-xl border-border/90 sm:col-span-2"
                  >
                    <Link href="/privacy">{t("footer.privacy")}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/*
            Depozyty (ukryte do czasu integracji Stripe):
            - zaliczka przy rezerwacji online, żeby ograniczyć no-show,
            - opcjonalnie tylko dla nowych klientów albo dla wszystkich,
            - kwota pobierana przed wizytą, zwrot wg regulaminu firmy.
            Po wdrożeniu płatności wróci karta z przełącznikami depositForNewClients,
            depositForAllClients i polem depositAmount.
          */}

          <div className="flex sm:hidden">
            <Button
              type="submit"
              form="settings-form"
              className="h-10 w-full rounded-xl"
              disabled={saving || settingsSaveBlocked}
            >
              {saving ? t("common.saving") : t("common.saveChanges")}
            </Button>
          </div>
        </form>
      </PageShell>
    </AppShell>
  )
}
