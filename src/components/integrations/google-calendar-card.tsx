"use client"

import * as React from "react"
import { Calendar, Check, Circle, Link2, Unlink } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import type { GoogleCalendarConnectionStatus, GoogleCalendarListItem } from "@/lib/integrations/google-calendar/types"
import { useTranslations } from "@/lib/i18n/use-translations"

export function GoogleCalendarCard() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const [status, setStatus] = React.useState<GoogleCalendarConnectionStatus | null>(null)
  const [calendars, setCalendars] = React.useState<GoogleCalendarListItem[]>([])
  const [selectedId, setSelectedId] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)

  const redirectUri =
    typeof window !== "undefined"
      ? `${window.location.origin.replace(/\/$/, "")}/api/integrations/google-calendar/callback`
      : "/api/integrations/google-calendar/callback"

  const loadStatus = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/integrations/google-calendar/status", { cache: "no-store" })
      const json = (await res.json()) as { ok?: boolean; status?: GoogleCalendarConnectionStatus }
      if (json.ok && json.status) {
        setStatus(json.status)
        setSelectedId(json.status.googleCalendarId ?? "")
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCalendars = React.useCallback(async () => {
    const res = await fetch("/api/integrations/google-calendar/calendars", { cache: "no-store" })
    const json = (await res.json()) as { ok?: boolean; calendars?: GoogleCalendarListItem[] }
    if (json.ok && json.calendars) {
      setCalendars(json.calendars)
      if (!selectedId && json.calendars.length > 0) {
        const primary = json.calendars.find((c) => c.primary) ?? json.calendars[0]
        if (primary) setSelectedId(primary.id)
      }
    }
  }, [selectedId])

  React.useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  React.useEffect(() => {
    const flag = searchParams.get("google_calendar")
    if (!flag) return
    if (flag === "connected") {
      toast.success(t("googleCalendarIntegration.toastConnected"))
      void loadStatus()
      void loadCalendars()
    } else if (flag === "access_denied") {
      toast.error(t("googleCalendarIntegration.toastAccessDenied"), {
        description: t("googleCalendarIntegration.toastAccessDeniedHint"),
        duration: 12_000,
      })
    } else if (flag === "cancelled") {
      toast.message(t("googleCalendarIntegration.toastCancelled"))
    } else if (flag === "missing_refresh") {
      toast.error(t("googleCalendarIntegration.toastMissingRefresh"))
    } else if (flag === "encryption_error") {
      toast.error(t("googleCalendarIntegration.toastEncryptionError"))
    } else {
      toast.error(t("googleCalendarIntegration.toastError"))
    }
  }, [searchParams, loadCalendars, loadStatus, t])

  React.useEffect(() => {
    if (status?.connected && status.persistenceReady && !status.googleCalendarId) {
      void loadCalendars()
    }
  }, [status, loadCalendars])

  const connect = () => {
    window.location.href = "/api/integrations/google-calendar/connect"
  }

  const disconnect = async () => {
    if (!window.confirm(t("googleCalendarIntegration.disconnectConfirm"))) return
    setBusy(true)
    try {
      const res = await fetch("/api/integrations/google-calendar/disconnect", { method: "POST" })
      const json = (await res.json()) as { ok?: boolean }
      if (json.ok) {
        toast.success(t("googleCalendarIntegration.toastDisconnected"))
        setCalendars([])
        setSelectedId("")
        await loadStatus()
      } else {
        toast.error(t("googleCalendarIntegration.toastError"))
      }
    } finally {
      setBusy(false)
    }
  }

  const saveCalendar = async () => {
    if (!selectedId.trim()) return
    setBusy(true)
    try {
      const picked = calendars.find((c) => c.id === selectedId.trim())
      const res = await fetch("/api/integrations/google-calendar/select-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: selectedId.trim(),
          calendarSummary: picked?.summary ?? null,
        }),
      })
      const json = (await res.json()) as { ok?: boolean }
      if (json.ok) {
        toast.success(t("googleCalendarIntegration.toastCalendarSaved"))
        await loadStatus()
      } else {
        toast.error(t("googleCalendarIntegration.toastError"))
      }
    } finally {
      setBusy(false)
    }
  }

  const connected = Boolean(status?.connected)
  const ready = Boolean(status?.persistenceReady)
  const configured = Boolean(status?.configured)
  const hasCalendar = Boolean(status?.googleCalendarId)
  const setup = status?.setup

  return (
    <Card
      id="google-calendar"
      className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5 scroll-mt-6"
    >
      <CardHeader className="border-b border-border/70 py-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-semibold">
              {t("googleCalendarIntegration.cardTitle")}
            </CardTitle>
            <CardDescription className="mt-1 text-xs text-muted-foreground">
              {t("googleCalendarIntegration.cardDescription")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <StatusBadge
          loading={loading}
          connected={connected && hasCalendar}
          ready={ready}
          setup={setup}
          t={t}
        />

        {!loading && setup && !ready ? (
          <SetupChecklist setup={setup} redirectUri={redirectUri} t={t} />
        ) : null}

        <div className="rounded-xl bg-muted/30 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">{t("googleCalendarIntegration.syncTitle")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("googleCalendarIntegration.syncItemCreate")}</li>
            <li>{t("googleCalendarIntegration.syncItemUpdate")}</li>
            <li>{t("googleCalendarIntegration.syncItemCancel")}</li>
            <li>{t("googleCalendarIntegration.syncItemTerminal")}</li>
          </ul>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("googleCalendarIntegration.loading")}</p>
        ) : null}

        {!loading && ready ? (
          <>
            <ProductionPublishingGuide redirectUri={redirectUri} t={t} />
            {status?.googleAccountEmail ? (
              <p className="text-xs text-muted-foreground">
                {t("googleCalendarIntegration.accountLabel")}:{" "}
                <span className="font-medium text-foreground">{status.googleAccountEmail}</span>
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!connected ? (
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={busy || !configured}
                  onClick={connect}
                >
                  <Link2 className="mr-1.5 size-4" aria-hidden />
                  {t("googleCalendarIntegration.connect")}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={busy}
                    onClick={() => void disconnect()}
                  >
                    <Unlink className="mr-1.5 size-4" aria-hidden />
                    {t("googleCalendarIntegration.disconnect")}
                  </Button>
                  {!hasCalendar ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-10 rounded-xl"
                      disabled={busy}
                      onClick={() => void loadCalendars()}
                    >
                      {t("googleCalendarIntegration.refreshCalendars")}
                    </Button>
                  ) : null}
                </>
              )}
            </div>

            {connected && (calendars.length > 0 || !hasCalendar) ? (
              <div className="space-y-2">
                <Label htmlFor="google-calendar-select">
                  {t("googleCalendarIntegration.calendarSelect")}
                </Label>
                <NativeSelect
                  id="google-calendar-select"
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="h-11 w-full rounded-xl"
                >
                  <option value="">{t("googleCalendarIntegration.calendarPlaceholder")}</option>
                  {calendars.map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {cal.summary}
                      {cal.primary ? ` (${t("googleCalendarIntegration.primaryBadge")})` : ""}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  className="h-10 rounded-xl"
                  disabled={busy || !selectedId.trim()}
                  onClick={() => void saveCalendar()}
                >
                  {t("googleCalendarIntegration.saveCalendar")}
                </Button>
              </div>
            ) : null}

            {connected && hasCalendar ? (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                {t("googleCalendarIntegration.activeHint")}
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ProductionPublishingGuide({
  redirectUri,
  t,
}: {
  redirectUri: string
  t: (key: string) => string
}) {
  const appOrigin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "https://wizytaok.pl"
  const productionRedirect =
    typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "https://wizytaok.pl/api/integrations/google-calendar/callback"
      : redirectUri

  const steps = [
    t("googleCalendarIntegration.productionStep1"),
    t("googleCalendarIntegration.productionStep2").replace("{redirectUri}", productionRedirect),
    t("googleCalendarIntegration.productionStep3"),
    t("googleCalendarIntegration.productionStep4"),
  ]

  const links = [
    {
      href: "https://console.cloud.google.com/apis/credentials/consent",
      label: t("googleCalendarIntegration.setupLinkOAuthConsent"),
    },
    {
      href: "https://console.cloud.google.com/apis/credentials/consent?tab=verification",
      label: t("googleCalendarIntegration.setupLinkPublishApp"),
    },
    {
      href: `${appOrigin}/privacy`,
      label: t("googleCalendarIntegration.setupLinkPrivacyPolicy"),
    },
  ]

  const copyScopeJustification = () => {
    void navigator.clipboard.writeText(t("googleCalendarIntegration.productionScopeJustification"))
    toast.success(t("googleCalendarIntegration.scopeJustificationCopied"))
  }

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-3">
      <p className="text-xs font-semibold text-foreground">
        {t("googleCalendarIntegration.productionTitle")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t("googleCalendarIntegration.productionLead")}
      </p>
      <ol className="mt-3 list-inside list-decimal space-y-2 text-xs leading-relaxed text-muted-foreground">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {link.label}
          </a>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-lg text-xs"
          onClick={copyScopeJustification}
        >
          {t("googleCalendarIntegration.copyScopeJustification")}
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground/90">
        {t("googleCalendarIntegration.productionInterim")}
      </p>
    </div>
  )
}

function SetupChecklist({
  setup,
  redirectUri,
  t,
}: {
  setup: NonNullable<GoogleCalendarConnectionStatus["setup"]>
  redirectUri: string
  t: (key: string) => string
}) {
  const supabaseProjectRef = React.useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    const match = raw.match(/https?:\/\/([^.]+)\.supabase\.co/i)
    return match?.[1] ?? null
  }, [])

  const links = [
    {
      href: "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com",
      label: t("googleCalendarIntegration.setupLinkCalendarApi"),
    },
    {
      href: "https://console.cloud.google.com/apis/credentials/consent",
      label: t("googleCalendarIntegration.setupLinkOAuthConsent"),
    },
    {
      href: "https://console.cloud.google.com/apis/credentials",
      label: t("googleCalendarIntegration.setupLinkCredentials"),
    },
    {
      href: supabaseProjectRef
        ? `https://supabase.com/dashboard/project/${supabaseProjectRef}/settings/api`
        : "https://supabase.com/dashboard/projects",
      label: t("googleCalendarIntegration.setupLinkSupabaseApi"),
    },
  ]

  const steps = [
    {
      done: setup.oauthConfigured,
      label: t("googleCalendarIntegration.setupStepOAuth").replace("{redirectUri}", redirectUri),
    },
    {
      done: setup.oauthConfigured,
      label: t("googleCalendarIntegration.setupStepEnv"),
    },
    {
      done: setup.encryptionConfigured,
      label: t("googleCalendarIntegration.setupStepEncryption"),
    },
    {
      done: setup.serviceRoleConfigured,
      label: t("googleCalendarIntegration.setupStepServiceRole"),
    },
    {
      done: setup.databaseReady,
      label: t("googleCalendarIntegration.setupStepMigration"),
    },
  ]

  const pending = steps.some((step) => !step.done)

  return (
    <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-3">
      <p className="text-xs font-medium text-foreground">{t("googleCalendarIntegration.setupTitle")}</p>
      <ul className="mt-2 space-y-2">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            {step.done ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-3.5 shrink-0 text-amber-600/80" aria-hidden />
            )}
            <span className={step.done ? "text-foreground/80" : undefined}>{step.label}</span>
          </li>
        ))}
      </ul>
      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      {pending ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("googleCalendarIntegration.setupRestartHint")}
        </p>
      ) : null}
    </div>
  )
}

function StatusBadge({
  loading,
  connected,
  ready,
  setup,
  t,
}: {
  loading: boolean
  connected: boolean
  ready: boolean
  setup: GoogleCalendarConnectionStatus["setup"] | undefined
  t: (key: string) => string
}) {
  if (loading) {
    return (
      <Badge variant="secondary" className="w-fit">
        {t("googleCalendarIntegration.statusLoading")}
      </Badge>
    )
  }
  if (!ready && setup) {
    if (!setup.oauthConfigured) {
      return (
        <Badge variant="outline" className="w-fit border-amber-500/40 text-amber-700 dark:text-amber-300">
          {t("googleCalendarIntegration.statusNeedsConfig")}
        </Badge>
      )
    }
    if (!setup.encryptionConfigured) {
      return (
        <Badge variant="outline" className="w-fit border-amber-500/40 text-amber-700 dark:text-amber-300">
          {t("googleCalendarIntegration.statusPendingEncryption")}
        </Badge>
      )
    }
    if (!setup.serviceRoleConfigured) {
      return (
        <Badge variant="outline" className="w-fit border-amber-500/40 text-amber-700 dark:text-amber-300">
          {t("googleCalendarIntegration.statusPendingServiceRole")}
        </Badge>
      )
    }
    if (!setup.databaseReady) {
      return (
        <Badge variant="outline" className="w-fit">
          {t("googleCalendarIntegration.statusPendingDb")}
        </Badge>
      )
    }
  }
  if (connected) {
    return (
      <Badge className="w-fit bg-emerald-600/90 text-white hover:bg-emerald-600/90">
        {t("googleCalendarIntegration.statusConnected")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="w-fit">
      {t("googleCalendarIntegration.statusDisconnected")}
    </Badge>
  )
}
