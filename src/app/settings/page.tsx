"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Download, RotateCcw } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BillingRequiredSettingsBanner } from "@/components/billing/billing-required-settings-banner"
import { BusinessOAuthSetupPanel } from "@/components/settings/business-oauth-setup-panel"
import { SettingsBookingFields } from "@/components/settings/settings-booking-fields"
import { SettingsBusinessFields } from "@/components/settings/settings-business-fields"
import { SettingsMobileMenu } from "@/components/settings/settings-mobile-menu"
import { SettingsSaveAlerts } from "@/components/settings/settings-save-alerts"
import { AccessDenied } from "@/components/shared/access-denied"
import { SettingsIntegrationsLinkCard } from "@/components/settings/settings-integrations-link-card"
import { TestBillingSettingsCard } from "@/components/settings/test-billing-settings-card"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { loadClientsWorkspace } from "@/lib/clients/clients-store"
import {
  buildAppointmentsCsv,
  buildClientsCsv,
  downloadCsvFile,
  type AppointmentCsvHeaders,
  type ClientCsvHeaders,
} from "@/lib/export/csv-export"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useSettingsFormContext } from "@/lib/settings/settings-form-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { AppointmentStatus } from "@/types/domain"

function SettingsOnboardingCard() {
  const { t } = useTranslations()
  const { restartOnboarding, setupComplete } = useOnboarding()
  const title = setupComplete ? t("onboarding.reconfigure") : t("onboarding.restart")
  const hint = setupComplete ? t("onboarding.reconfigureHint") : t("onboarding.restartHint")

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="border-b border-border/70 py-4">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">{hint}</CardDescription>
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
  const { ready, businessId, canManageSettings, refresh } = useBusinessAccess()
  const { saving, settingsSaveBlocked, saveAll } = useSettingsFormContext()
  const [exportBusy, setExportBusy] = React.useState<"appointments" | "clients" | null>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const billing = params.get("billing")
    queueMicrotask(() => {
      setShowBillingRequiredBanner(billing === "required")
      setOauthBusinessSetup(params.get("setup") === "business")
    })
  }, [])

  const statusLabelLookup = React.useCallback(
    (status: AppointmentStatus) =>
      t(`labels.appointmentStatus.${status}` as "labels.appointmentStatus.booked"),
    [t],
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
        <div className="hidden lg:block">
          <Button
            type="submit"
            form="settings-form"
            size="sm"
            className="h-10 rounded-xl px-4 text-sm"
            disabled={saving || settingsSaveBlocked}
          >
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </div>
      }
    >
      <PageShell>
        {oauthBusinessSetup && ready && !businessId ? (
          <BusinessOAuthSetupPanel
            onProfileSaved={() => {
              void refresh()
            }}
          />
        ) : null}

        <div className="lg:hidden">
          <SettingsMobileMenu />
        </div>

        <div className="hidden lg:block">
          {showBillingRequiredBanner ? <BillingRequiredSettingsBanner /> : null}
          <SettingsSaveAlerts />

          <form id="settings-form" onSubmit={(e) => void saveAll(e)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
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
                  <CardContent className="pt-4">
                    <SettingsBusinessFields />
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
                  <CardContent className="pt-4">
                    <SettingsBookingFields />
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
                {canManageSettings ? <SettingsIntegrationsLinkCard /> : null}
                <TestBillingSettingsCard />
                <SettingsOnboardingCard />

                <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
                  <CardHeader className="border-b border-border/70 py-4">
                    <CardTitle className="text-sm font-semibold">{t("settings.legalInfoTitle")}</CardTitle>
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
          </form>
        </div>
      </PageShell>
    </AppShell>
  )
}
