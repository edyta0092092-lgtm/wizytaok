"use client"

import * as React from "react"
import { CalendarDays, Check, Clock } from "lucide-react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AvailabilityExceptionsCalendar } from "@/components/availability/availability-exceptions-calendar"
import { AccessDenied } from "@/components/shared/access-denied"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import {
  getAvailabilityRules,
  saveAvailabilityRules,
} from "@/lib/availability/availability-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import type { AvailabilityDay } from "@/types/domain"

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export default function AvailabilityPage() {
  const { t, language } = useTranslations()
  const access = useBusinessAccess()
  const [days, setDays] = React.useState<AvailabilityDay[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [businessProfileId, setBusinessProfileId] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const refresh = React.useCallback(async () => {
    const client = getBrowserClient()
    let profileId: string | null = null
    if (client && isSupabaseConfigured()) {
      profileId = await getCurrentBusinessProfileIdForClient(client)
      setBusinessProfileId(profileId)
    } else {
      setBusinessProfileId(null)
    }
    try {
      const list = await getAvailabilityRules(client, profileId)
      setDays(list)
      setLoadError(false)
    } catch {
      setLoadError(true)
      setDays([])
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      await refresh()
      if (!cancelled) setLoading(false)
    })()
    const onPw = () => {
      void refresh()
    }
    window.addEventListener("pw-availability", onPw)
    window.addEventListener("focus", onPw)
    return () => {
      cancelled = true
      window.removeEventListener("pw-availability", onPw)
      window.removeEventListener("focus", onPw)
    }
  }, [refresh])

  const updateDay = (
    id: string,
    patch: Partial<Pick<AvailabilityDay, "isOpen" | "startTime" | "endTime">>
  ) => {
    setDays((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  React.useEffect(() => {
    if (!saved) return
    const tid = window.setTimeout(() => setSaved(false), 3200)
    return () => window.clearTimeout(tid)
  }, [saved])

  const openDays = days.filter((d) => d.isOpen)
  const workingDays = openDays.length
  const weeklyMinutes = openDays.reduce((sum, d) => {
    return sum + Math.max(0, toMinutes(d.endTime) - toMinutes(d.startTime))
  }, 0)
  const weeklyHours = (weeklyMinutes / 60).toFixed(1)

  const earliest = openDays.length
    ? fromMinutes(
        Math.min(...openDays.map((d) => toMinutes(d.startTime)))
      )
    : "-"
  const latest = openDays.length
    ? fromMinutes(
        Math.max(...openDays.map((d) => toMinutes(d.endTime)))
      )
    : "-"

  const weekdayLabel = (label: string) => {
    return t(`availability.${label}`)
  }

  const saveAvailability = () => {
    void (async () => {
      setSaving(true)
      setSaveError(false)
      const client = getBrowserClient()
      const res = await saveAvailabilityRules(client, businessProfileId, days)
      setSaving(false)
      if (!res.ok) {
        setSaveError(true)
        return
      }
      setSaved(true)
      await refresh()
    })()
  }

  if (access.ready && !access.canManageAvailability) {
    return (
      <AppShell title={t("navigation.availability")} pageDescription={t("availability.description")}>
        <PageShell>
          <AccessDenied />
        </PageShell>
      </AppShell>
    )
  }

  return (
    <AppShell
      title={t("navigation.availability")}
      pageDescription={t("availability.description")}
      primaryAction={
        <Button
          type="button"
          size="sm"
          className="h-9 text-sm"
          onClick={saveAvailability}
          disabled={loading || loadError || saving}
          data-tour="availability-save"
        >
          {t("availability.saveButton")}
        </Button>
      }
    >
      <PageShell>
        {loading ? (
          <p className="mb-4 text-sm text-muted-foreground" role="status">
            {t("availability.loadingAvailability")}
          </p>
        ) : null}
        {loadError ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {t("availability.loadAvailabilityError")}
          </div>
        ) : null}
        {saveError ? (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {t("availability.saveAvailabilityError")}
          </div>
        ) : null}
        {saved ? (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success-foreground shadow-sm shadow-slate-900/5"
          >
            <Check className="size-4 shrink-0 text-success" aria-hidden />
            {t("availability.savedBanner")}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("availability.workingDays")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {workingDays}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("availability.weeklyHours")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {weeklyHours} h
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("availability.earliest")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {earliest}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
            <CardContent className="px-4 py-3.5">
              <p className="text-xs font-medium text-muted-foreground">
                {t("availability.latest")}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
                {latest}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-5 rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
          <CardHeader className="border-b border-border/70 py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              {t("availability.workingHours")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4" data-tour="availability-list">
            <ul className="flex min-w-0 flex-col gap-2.5">
              {days.map((day) => (
                <li key={day.id} className="min-w-0">
                  <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 px-4 py-3 md:grid-cols-[1.2fr_auto_1fr_1fr] md:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {weekdayLabel(day.label)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={day.isOpen}
                        onCheckedChange={(checked) =>
                          updateDay(day.id, { isOpen: Boolean(checked) })
                        }
                        disabled={loading || loadError}
                        aria-label={day.isOpen ? t("availability.open") : t("availability.closed")}
                      />
                      <span className="text-xs text-muted-foreground">
                        {day.isOpen ? t("availability.open") : t("availability.closed")}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor={`from-${day.id}`} className="text-xs">
                          {t("availability.from")}
                        </Label>
                        <Input
                          id={`from-${day.id}`}
                          type="time"
                          value={day.startTime}
                          disabled={!day.isOpen || loading || loadError}
                          onChange={(e) =>
                            updateDay(day.id, { startTime: e.target.value })
                          }
                          className="h-9 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`to-${day.id}`} className="text-xs">
                          {t("availability.to")}
                        </Label>
                        <Input
                          id={`to-${day.id}`}
                          type="time"
                          value={day.endTime}
                          disabled={!day.isOpen || loading || loadError}
                          onChange={(e) =>
                            updateDay(day.id, { endTime: e.target.value })
                          }
                          className="h-9 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-start gap-2 text-xs text-muted-foreground md:justify-end">
                      <Clock className="size-3.5" aria-hidden />
                      {day.isOpen
                        ? `${day.startTime} - ${day.endTime}`
                        : t("availability.closed")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <AvailabilityExceptionsCalendar
          businessProfileId={businessProfileId}
          weeklyDays={days}
          language={language}
          t={t}
        />
      </PageShell>
    </AppShell>
  )
}
