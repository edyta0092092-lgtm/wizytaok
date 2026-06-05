"use client"

import * as React from "react"
import { Calendar, Link2, Unlink } from "lucide-react"
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
    } else if (flag === "cancelled") {
      toast.message(t("googleCalendarIntegration.toastCancelled"))
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
      const res = await fetch("/api/integrations/google-calendar/select-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId: selectedId.trim() }),
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

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
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
          <StatusBadge loading={loading} connected={connected && hasCalendar} ready={ready} t={t} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {!configured ? (
          <p className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            {t("googleCalendarIntegration.notConfiguredEnv")}
          </p>
        ) : null}

        {configured && !ready ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {t("googleCalendarIntegration.persistencePending")}
          </p>
        ) : null}

        <div className="rounded-xl bg-muted/30 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">{t("googleCalendarIntegration.syncTitle")}</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>{t("googleCalendarIntegration.syncItemCreate")}</li>
            <li>{t("googleCalendarIntegration.syncItemCancel")}</li>
            <li>{t("googleCalendarIntegration.syncItemTerminal")}</li>
          </ul>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("googleCalendarIntegration.loading")}</p>
        ) : null}

        {!loading && ready ? (
          <>
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

function StatusBadge({
  loading,
  connected,
  ready,
  t,
}: {
  loading: boolean
  connected: boolean
  ready: boolean
  t: (key: string) => string
}) {
  if (loading) {
    return (
      <Badge variant="secondary" className="shrink-0">
        {t("googleCalendarIntegration.statusLoading")}
      </Badge>
    )
  }
  if (!ready) {
    return (
      <Badge variant="outline" className="shrink-0">
        {t("googleCalendarIntegration.statusPendingDb")}
      </Badge>
    )
  }
  if (connected) {
    return (
      <Badge className="shrink-0 bg-emerald-600/90 text-white hover:bg-emerald-600/90">
        {t("googleCalendarIntegration.statusConnected")}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="shrink-0">
      {t("googleCalendarIntegration.statusDisconnected")}
    </Badge>
  )
}
