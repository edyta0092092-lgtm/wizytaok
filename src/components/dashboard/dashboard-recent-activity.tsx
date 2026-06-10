"use client"

import * as React from "react"
import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Appointment } from "@/types/domain"

type ActivityRow = {
  id: string
  label: string
  at: string
  href: string
}

function buildFallbackActivity(appointments: Appointment[]): ActivityRow[] {
  return [...appointments]
    .map((a) => ({
      id: a.id,
      at: a.lastStatusChangeAt ?? a.createdAt ?? a.startsAt,
      label: a.clientName,
      href: "/appointments",
      sortKey: new Date(a.lastStatusChangeAt ?? a.createdAt ?? a.startsAt).getTime(),
    }))
    .filter((row) => Number.isFinite(row.sortKey))
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 5)
    .map(({ sortKey: _sortKey, ...row }) => ({
      ...row,
      label: row.label,
    }))
}

export function DashboardRecentActivity({
  businessId,
  appointments,
}: {
  businessId: string | null | undefined
  appointments: Appointment[]
}) {
  const { t, language } = useTranslations()
  const [rows, setRows] = React.useState<ActivityRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [language],
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        if (!businessId || !isSupabaseConfigured()) {
          if (!cancelled) setRows(buildFallbackActivity(appointments))
          return
        }
        const client = getBrowserClient()
        if (!client) {
          if (!cancelled) setRows(buildFallbackActivity(appointments))
          return
        }
        const { data, error } = await client
          .from("notification_logs")
          .select("id,created_at,channel,status,type,recipient")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(5)

        if (error || !data?.length) {
          if (!cancelled) setRows(buildFallbackActivity(appointments))
          return
        }

        if (!cancelled) {
          setRows(
            data.map((row) => ({
              id: row.id,
              at: row.created_at,
              href: "/messages",
              label: t("dashboard.recentActivitySend")
                .replace("{channel}", String(row.channel ?? "").toUpperCase())
                .replace("{status}", String(row.status ?? "")),
            })),
          )
        }
      } catch {
        if (!cancelled) setRows(buildFallbackActivity(appointments))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [appointments, businessId, t])

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t("dashboard.recentActivity")}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.statsLoading")}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.recentActivityEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border/80">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex min-h-11 touch-manipulation items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/30"
                >
                  <span className="min-w-0 truncate font-medium text-foreground">{row.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {dateFmt.format(new Date(row.at))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
