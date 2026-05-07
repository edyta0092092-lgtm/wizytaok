"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Download } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { saveBusinessProfileAction } from "@/app/settings/business-profile-actions"
import { AccessDenied } from "@/components/shared/access-denied"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { loadClientsWorkspace } from "@/lib/clients/clients-store"
import { bookingSourceCsvLabelKey } from "@/lib/bookings/booking-source"
import {
  buildAppointmentsCsv,
  buildClientsCsv,
  downloadCsvFile,
  type AppointmentCsvHeaders,
  type ClientCsvHeaders,
} from "@/lib/export/csv-export"
import {
  hoursToReminderLead,
  minutesToSecondReminder,
  reminderLeadToHours,
  secondReminderToMinutes,
  type SecondReminderSetting,
} from "@/lib/settings/reminder-lead"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { AppointmentStatus } from "@/types/domain"

type ReminderLead = "2h" | "6h" | "12h" | "24h" | "48h"
type SecondReminderLead = SecondReminderSetting
type ReminderChannel = "sms" | "email" | "both"

const REMINDER_LEAD_VALUES: ReminderLead[] = ["2h", "6h", "12h", "24h", "48h"]
const SECOND_REMINDER_VALUES: SecondReminderLead[] = ["disabled", "30m", "1h", "2h", "3h"]
const REMINDER_CHANNEL_VALUES: ReminderChannel[] = ["sms", "email", "both"]
const SETTINGS_STORAGE_KEY = "pw_settings_form_v2"

type SettingsForm = {
  businessName: string
  publicSlug: string
  ownerName: string
  email: string
  phone: string
  taxId: string
  reminderLead: ReminderLead
  secondReminderLead: SecondReminderLead
  reminderChannel: ReminderChannel
  depositForNewClients: boolean
  depositForAllClients: boolean
  depositAmount: string
}

const defaultSettings: SettingsForm = {
  businessName: "Studio WizytaOK",
  publicSlug: "studio-potwierdzen",
  ownerName: "Jan Kowalski",
  email: "kontakt@example.pl",
  phone: "+48 600 000 000",
  taxId: "",
  reminderLead: "24h",
  secondReminderLead: "2h",
  reminderChannel: "both",
  depositForNewClients: false,
  depositForAllClients: false,
  depositAmount: "50",
}

export default function SettingsPage() {
  const { t, language, setLanguage, theme, setTheme } = useTranslations()
  const { ready, businessId, canManageSettings, effectiveRole } = useBusinessAccess()
  const staffAppearanceOnly = Boolean(ready && effectiveRole === "staff")
  const [form, setForm] = React.useState<SettingsForm>(defaultSettings)
  const [draftLanguage, setDraftLanguage] = React.useState<"pl" | "en">(language)
  const [draftTheme, setDraftTheme] = React.useState<"light" | "dark">(theme)
  const [showSaved, setShowSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [exportBusy, setExportBusy] = React.useState<"appointments" | "clients" | null>(null)
  const [saving, setSaving] = React.useState(false)

  const taxIdDigitsHint = React.useMemo(() => {
    const compact = form.taxId.replace(/[\s-]/g, "")
    if (!compact) return null
    if (!/^\d+$/.test(compact)) return t("settings.taxIdDigitsHint")
    if (compact.length !== 10) return t("settings.taxIdDigitsHint")
    return null
  }, [form.taxId, t])

  React.useEffect(() => {
    queueMicrotask(() => {
      setDraftLanguage(language)
    })
  }, [language])

  React.useEffect(() => {
    queueMicrotask(() => {
      setDraftTheme(theme)
    })
  }, [theme])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsForm>
        queueMicrotask(() => {
          setForm((prev) => ({ ...prev, ...parsed }))
        })
      }
    } catch {
      // ignore
    }
  }, [])

  React.useEffect(() => {
    if (!isSupabaseConfigured() || staffAppearanceOnly) return
    const client = getBrowserClient()
    if (!client) return
    void client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      void client
        .from("business_profiles")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!data) return
          const ch = data.reminder_channel
          const reminderChannel: ReminderChannel =
            ch === "sms" || ch === "email" || ch === "both" ? ch : "both"
          const hours =
            typeof data.default_reminder_hours === "number" && Number.isFinite(data.default_reminder_hours)
              ? data.default_reminder_hours
              : 24
          setForm((f) => ({
            ...f,
            businessName: data.business_name,
            publicSlug: data.slug,
            ownerName: data.owner_name ?? "",
            email: data.email ?? user.email ?? f.email,
            phone: data.phone ?? "",
            taxId: typeof data.tax_id === "string" ? data.tax_id : f.taxId,
            reminderLead: hoursToReminderLead(hours),
            secondReminderLead: minutesToSecondReminder(
              typeof data.second_reminder_minutes === "number" && Number.isFinite(data.second_reminder_minutes)
                ? data.second_reminder_minutes
                : 120
            ),
            reminderChannel,
          }))
        })
    })
  }, [staffAppearanceOnly])

  const saveAppearancePrefs = (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setSaving(true)
    try {
      setLanguage(draftLanguage)
      setTheme(draftTheme)
      setShowSaved(true)
    } finally {
      setSaving(false)
    }
  }

  React.useEffect(() => {
    if (!showSaved) return
    const tid = window.setTimeout(() => setShowSaved(false), 4500)
    return () => window.clearTimeout(tid)
  }, [showSaved])

  const reminderLeadOptions = React.useMemo(
    () =>
      REMINDER_LEAD_VALUES.map((value) => ({
        value,
        label: t(`settings.reminderLead.${value}` as `settings.reminderLead.${ReminderLead}`),
      })),
    [t]
  )

  const reminderChannelOptions = React.useMemo(
    () =>
      REMINDER_CHANNEL_VALUES.map((value) => ({
        value,
        label: t(
          `settings.reminderChannel.${value}` as `settings.reminderChannel.${ReminderChannel}`
        ),
      })),
    [t]
  )

  const secondReminderOptions = React.useMemo(
    () =>
      SECOND_REMINDER_VALUES.map((value) => ({
        value,
        label: t(
          `settings.secondReminder.${value}` as `settings.secondReminder.${SecondReminderLead}`
        ),
      })),
    [t]
  )

  const statusLabelLookup = React.useCallback(
    (status: AppointmentStatus) =>
      t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked"),
    [t]
  )

  const exportAppointmentsCsv = () => {
    void (async () => {
      setExportBusy("appointments")
      try {
        const rows = await fetchMergedAppointments()
        const headers: AppointmentCsvHeaders = {
          date: t("settings.csvColDate"),
          time: t("settings.csvColTime"),
          client: t("settings.csvColClient"),
          phone: t("settings.csvColPhone"),
          email: t("settings.csvColEmail"),
          service: t("settings.csvColService"),
          status: t("settings.csvColStatus"),
          staff: t("settings.csvStaffCol"),
          source: t("settings.csvColSource"),
        }
        const csv = buildAppointmentsCsv(rows, headers, statusLabelLookup, (a) =>
          t(bookingSourceCsvLabelKey(a.source)), t("team.anyStaff")
        )
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
        const { clients } = await loadClientsWorkspace()
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
          slug: form.publicSlug,
          ownerName: form.ownerName,
          email: form.email,
          phone: form.phone,
          taxId: normalizeTaxIdPayload(form.taxId),
          defaultReminderHours: reminderLeadToHours(form.reminderLead),
          secondReminderMinutes: secondReminderToMinutes(form.secondReminderLead),
          reminderChannel: form.reminderChannel,
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
          const fallbackError =
            process.env.NODE_ENV === "development" && result.details
              ? `${t("common.saveError")} ${t("help.errorDetailsPrefix")} ${result.details}`
              : t("common.saveError")
          setSaveError(fallbackError)
          return
        }
      }

      setLanguage(draftLanguage)
      setTheme(draftTheme)
      setShowSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (staffAppearanceOnly) {
    return (
      <AppShell
        title={t("navigation.settings")}
        pageDescription={t("settings.staffAppearancePageDescription")}
        primaryAction={
          <Button
            type="submit"
            form="staff-settings-appearance-form"
            size="sm"
            className="h-10 rounded-xl px-4 text-sm"
            disabled={saving}
          >
            {saving ? "..." : t("common.saveChanges")}
          </Button>
        }
      >
        <PageShell>
          {showSaved ? (
            <div
              role="status"
              className="mb-4 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground shadow-sm shadow-slate-900/5"
            >
              <Check className="size-4 shrink-0 text-success" aria-hidden />
              {t("settings.savedBanner")}
            </div>
          ) : null}
          <form
            id="staff-settings-appearance-form"
            onSubmit={saveAppearancePrefs}
            className="max-w-xl space-y-6"
          >
            <Card className="self-start rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
              <CardHeader className="border-b border-border/70 py-4">
                <CardTitle className="text-sm font-semibold">{t("settings.appearance")}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {t("settings.appearancePrefsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="staff-ui-language">{t("settings.language")}</Label>
                  <Select value={draftLanguage} onValueChange={(v) => setDraftLanguage(v as "pl" | "en")}>
                    <SelectTrigger id="staff-ui-language" className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pl">{t("settings.polish")}</SelectItem>
                      <SelectItem value="en">{t("settings.english")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-ui-theme">{t("settings.theme")}</Label>
                  <Select value={draftTheme} onValueChange={(v) => setDraftTheme(v as "light" | "dark")}>
                    <SelectTrigger id="staff-ui-theme" className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">{t("settings.light")}</SelectItem>
                      <SelectItem value="dark">{t("settings.dark")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground">{t("settings.staffAppearanceFooterNote")}</p>
          </form>
        </PageShell>
      </AppShell>
    )
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
          disabled={saving}
        >
          {saving ? "..." : t("common.saveChanges")}
        </Button>
      }
    >
      <PageShell
      >
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
          {/* Dwie osobne kolumny-flex – brak współdzielonej wysokości rzędu siatki między kartami */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
            <div className="flex min-w-0 flex-col gap-6">
              <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardHeader className="border-b border-border/70 py-4">
              <CardTitle className="text-sm font-semibold">
                {t("settings.appearance")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("settings.appearancePrefsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ui-language">{t("settings.language")}</Label>
                <Select
                  value={draftLanguage}
                  onValueChange={(v) => setDraftLanguage(v as "pl" | "en")}
                >
                  <SelectTrigger
                    id="ui-language"
                    className="h-11 w-full min-w-0 rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pl">{t("settings.polish")}</SelectItem>
                    <SelectItem value="en">{t("settings.english")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ui-theme">{t("settings.theme")}</Label>
                <Select
                  value={draftTheme}
                  onValueChange={(v) => setDraftTheme(v as "light" | "dark")}
                >
                  <SelectTrigger
                    id="ui-theme"
                    className="h-11 w-full min-w-0 rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{t("settings.light")}</SelectItem>
                    <SelectItem value="dark">{t("settings.dark")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card
            data-tour="settings-reminders"
            className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5"
          >
            <CardHeader className="border-b border-border/70 py-4">
              <CardTitle className="text-sm font-semibold">
                {t("settings.reminders")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("settings.remindersCardDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 pt-4 md:gap-6">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="reminder-lead" className="flex min-h-10 items-end text-sm leading-snug">
                  {t("settings.reminderLeadLabel")}
                </Label>
                <Select
                  value={form.reminderLead}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      reminderLead: v as ReminderLead,
                    }))
                  }
                >
                  <SelectTrigger id="reminder-lead" className="h-11 w-full min-w-0 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderLeadOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label
                  htmlFor="reminder-channel"
                  className="flex min-h-10 items-end text-sm leading-snug"
                >
                  {t("settings.reminderChannelLabel")}
                </Label>
                <Select
                  value={form.reminderChannel}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      reminderChannel: v as ReminderChannel,
                    }))
                  }
                >
                  <SelectTrigger id="reminder-channel" className="h-11 w-full min-w-0 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderChannelOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex min-w-0 flex-col gap-2">
                <Label htmlFor="second-reminder-lead" className="text-sm leading-snug">
                  {t("settings.secondReminderLeadLabel")}
                </Label>
                <Select
                  value={form.secondReminderLead}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      secondReminderLead: v as SecondReminderLead,
                    }))
                  }
                >
                  <SelectTrigger
                    id="second-reminder-lead"
                    className="h-11 w-full min-w-0 max-w-md rounded-xl"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {secondReminderOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("settings.secondReminderHint")}</p>
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

            <div className="flex min-w-0 flex-col gap-6">
              <Card
            data-tour="settings-company"
            className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5"
          >
            <CardHeader className="border-b border-border/70 py-4">
              <CardTitle className="text-sm font-semibold">
                {t("settings.business")}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {t("settings.businessCardDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4 pt-4 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{t("auth.businessProfileTitle")}</p>
                <p className="mt-1 leading-relaxed">{t("settings.supabaseProfileHint")}</p>
              </div>
              <div className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{t("settings.operatorStatusTitle")}</p>
                <p className="mt-1 leading-relaxed">{t("settings.operatorStatusHint")}</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="businessName">{t("settings.businessNameLabel")}</Label>
                <Input
                  id="businessName"
                  autoComplete="organization"
                  value={form.businessName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, businessName: e.target.value }))
                  }
                  placeholder={t("settings.placeholderBusinessExample")}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="publicSlug">{t("settings.bookingAddressLabel")}</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("settings.bookingAddressHint")}
                </p>
                <p className="text-xs font-medium text-foreground">
                  {t("settings.bookingAddressExample")}
                </p>
                <Input
                  id="publicSlug"
                  autoComplete="off"
                  value={form.publicSlug}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      publicSlug: e.target.value.trim().toLowerCase(),
                    }))
                  }
                  className="h-11 rounded-xl font-mono text-sm"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tax-id">{t("settings.taxIdLabel")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.taxIdHint")}</p>
                <Input
                  id="tax-id"
                  autoComplete="off"
                  value={form.taxId}
                  onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                  placeholder={t("settings.taxIdPlaceholder")}
                  className="h-11 rounded-xl"
                />
                {taxIdDigitsHint ? (
                  <p className="text-xs text-amber-800 dark:text-amber-200">{taxIdDigitsHint}</p>
                ) : null}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="ownerName">{t("settings.ownerNameLabel")}</Label>
                <Input
                  id="ownerName"
                  autoComplete="name"
                  value={form.ownerName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ownerName: e.target.value }))
                  }
                  placeholder={t("settings.placeholderOwnerExample")}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-email">{t("settings.emailLabel")}</Label>
                <Input
                  id="settings-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="kontakt@twojadomena.pl"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings-phone">{t("settings.phoneLabel")}</Label>
                <Input
                  id="settings-phone"
                  type="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="+48 600 000 000"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2 rounded-xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("settings.bookingLiveLinkTitle")}
                </p>
                <div className="mt-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link
                      href={`/book/${form.publicSlug || "studio-potwierdzen"}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("settings.openBookingPage")}
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardHeader className="border-b border-border/70 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  {t("settings.deposits")}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="inline-flex items-center whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-amber-200"
                >
                  {t("settings.stripeSoon")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label
                    htmlFor="deposit-required"
                    className="text-sm font-medium text-foreground"
                  >
                    {t("settings.depositNewClientsLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.depositNewClientsHint")}
                  </p>
                </div>
                <Switch
                  id="deposit-required"
                  checked={form.depositForNewClients}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, depositForNewClients: Boolean(checked) }))
                  }
                  className="shrink-0"
                  aria-label={t("settings.depositAria")}
                />
              </div>
              <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="deposit-all" className="text-sm font-medium text-foreground">
                    {t("settings.depositAllClientsLabel")}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t("settings.depositAllClientsHint")}</p>
                </div>
                <Switch
                  id="deposit-all"
                  checked={form.depositForAllClients}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, depositForAllClients: Boolean(checked) }))
                  }
                  className="shrink-0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deposit-amount">{t("settings.depositAmountLabel")}</Label>
                <Input
                  id="deposit-amount"
                  inputMode="decimal"
                  value={form.depositAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depositAmount: e.target.value }))
                  }
                  placeholder={t("settings.placeholderDepositAmount")}
                  disabled={!form.depositForNewClients && !form.depositForAllClients}
                  className="h-11 max-w-xs rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  {t("settings.depositAmountHint")}
                </p>
                <p className="text-xs text-muted-foreground">{t("settings.depositAfterPaymentsHint")}</p>
              </div>
            </CardContent>
          </Card>

              <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardHeader className="border-b border-border/70 py-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">
                  {t("settings.legalInfoTitle")}
                </CardTitle>
                <Badge
                  variant="outline"
                  className="rounded-full border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                >
                  {t("settings.betaBadge")}
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                {t("settings.legalInfoDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pt-4 sm:grid-cols-2 sm:gap-3">
              <p className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                {t("settings.betaNotice")}
              </p>
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

          <div className="flex sm:hidden">
            <Button
              type="submit"
              form="settings-form"
              className="h-10 w-full rounded-xl"
            >
              {saving ? "..." : t("common.saveChanges")}
            </Button>
          </div>
        </form>
      </PageShell>
    </AppShell>
  )
}
