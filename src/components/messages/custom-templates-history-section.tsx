"use client"

import * as React from "react"

import { semanticStatusBadgeClass } from "@/components/shared/status-tone"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"

type SendRow = Tables<"custom_template_sends">
type ChannelFilter = "all" | "sms" | "email"
type StatusFilter = "all" | "sent" | "failed" | "skipped"

type BookingMini = { client_name: string | null; appointment_date: string; appointment_time: string }

function eventTimeIso(row: SendRow): string {
  return row.sent_at ?? row.failed_at ?? row.skipped_at ?? row.created_at
}

function statusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "sent") return "success"
  if (status === "failed") return "danger"
  if (status === "skipped") return "warning"
  return "neutral"
}

function statusLabel(status: string): string {
  switch (status) {
    case "sent":
      return "Wysłano"
    case "failed":
      return "Błąd"
    case "skipped":
      return "Pominięto"
    case "processing":
      return "W toku"
    case "pending":
      return "Oczekuje"
    default:
      return status
  }
}

function errorLabel(raw: string | null): string | null {
  const e = (raw ?? "").trim()
  if (!e) return null
  if (e === "sms_monthly_limit_reached") return "Miesięczny limit SMS wyczerpany"
  if (e === "sms_quota_count_failed") return "Nie udało się policzyć limitu SMS (spróbuje ponownie)"
  return e
}

export function CustomTemplatesHistorySection() {
  const { language } = useTranslations()
  const { ready, businessId } = useBusinessAccess()
  const [rows, setRows] = React.useState<SendRow[]>([])
  const [names, setNames] = React.useState<Record<string, string>>({})
  const [bookings, setBookings] = React.useState<Record<string, BookingMini>>({})
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [channelFilter, setChannelFilter] = React.useState<ChannelFilter>("all")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [preview, setPreview] = React.useState<SendRow | null>(null)

  React.useEffect(() => {
    if (!ready) return
    let cancelled = false
    void (async () => {
      setLoading(true)
      const client = getBrowserClient()
      if (!businessId || !isSupabaseConfigured() || !client) {
        if (!cancelled) {
          setRows([])
          setLoading(false)
        }
        return
      }
      const { data, error } = await client
        .from("custom_template_sends")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(200)
      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setRows([])
        setLoading(false)
        return
      }
      const sendRows = (data ?? []) as SendRow[]
      setLoadError(null)
      setRows(sendRows)

      const templateIds = Array.from(new Set(sendRows.map((r) => r.custom_template_id)))
      const appointmentIds = Array.from(new Set(sendRows.map((r) => r.appointment_id)))
      const [tpls, books] = await Promise.all([
        templateIds.length
          ? client.from("custom_templates").select("id,name").in("id", templateIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
        appointmentIds.length
          ? client
              .from("bookings")
              .select("id,client_name,appointment_date,appointment_time")
              .in("id", appointmentIds)
          : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      ])
      if (cancelled) return
      const nameMap: Record<string, string> = {}
      for (const row of (tpls.data ?? []) as Array<{ id: string; name: string }>) {
        nameMap[row.id] = row.name
      }
      setNames(nameMap)
      const bookingMap: Record<string, BookingMini> = {}
      for (const row of (books.data ?? []) as Array<{
        id: string
        client_name: string | null
        appointment_date: string
        appointment_time: string
      }>) {
        bookingMap[row.id] = {
          client_name: row.client_name ?? null,
          appointment_date: row.appointment_date,
          appointment_time: row.appointment_time,
        }
      }
      setBookings(bookingMap)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ready, businessId])

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [language],
  )

  const filtered = React.useMemo(() => {
    return rows
      .filter((r) => (channelFilter === "all" ? true : r.channel === channelFilter))
      .filter((r) => (statusFilter === "all" ? true : r.status === statusFilter))
  }, [rows, channelFilter, statusFilter])

  if (!ready) return null

  return (
    <section
      aria-labelledby="custom-history-heading"
      className="mt-10 min-w-0 scroll-mt-24"
    >
      <h2 id="custom-history-heading" className="mb-3 text-base font-semibold text-foreground">
        Historia własnych szablonów
      </h2>

      {loadError ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
        <CardHeader className="space-y-3 pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-full border border-input bg-background px-3 text-xs sm:text-sm"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
            >
              <option value="all">Wszystkie kanały</option>
              <option value="sms">SMS</option>
              <option value="email">E-mail</option>
            </select>
            <select
              className="h-9 rounded-full border border-input bg-background px-3 text-xs sm:text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Wszystkie statusy</option>
              <option value="sent">Wysłane</option>
              <option value="failed">Błędy</option>
              <option value="skipped">Pominięte</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Wczytywanie…</p>
          ) : filtered.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Brak wysyłek własnych szablonów do pokazania.
            </p>
          ) : (
            <ul className="premium-scrollbar max-h-[500px] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {filtered.map((row) => {
                const tplName = names[row.custom_template_id] || "Własny szablon"
                const booking = bookings[row.appointment_id]
                const err = errorLabel(row.last_error)
                return (
                  <li key={row.id} className="min-h-[4.5rem] px-3 py-3 sm:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {tplName} · {row.channel === "email" ? "E-mail" : "SMS"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              semanticStatusBadgeClass(statusTone(row.status)),
                            )}
                          >
                            {statusLabel(row.status)}
                          </span>
                          <span className="tabular-nums">{dateFmt.format(new Date(eventTimeIso(row)))}</span>
                          {row.recipient?.trim() ? (
                            <span className="break-all">{row.recipient.trim()}</span>
                          ) : null}
                        </div>
                        {booking ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {(booking.client_name ?? "").trim() || "Klient"} ·{" "}
                            {String(booking.appointment_date).slice(0, 10)}{" "}
                            {String(booking.appointment_time).slice(0, 5)}
                          </p>
                        ) : null}
                        {err ? <p className="mt-1 text-[11px] text-destructive">{err}</p> : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-full shrink-0 sm:w-auto"
                        onClick={() => setPreview(row)}
                      >
                        Podgląd
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(preview)} onOpenChange={(o) => (!o ? setPreview(null) : undefined)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-border/80 bg-card p-0 sm:max-w-lg"
          showCloseButton
        >
          {preview ? (
            <>
              <SheetHeader className="space-y-1 border-b border-border/70 px-6 py-6 text-left">
                <SheetTitle className="font-heading text-lg">Podgląd wiadomości</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {(names[preview.custom_template_id] || "Własny szablon") +
                    " · " +
                    (preview.channel === "email" ? "E-mail" : "SMS")}
                </SheetDescription>
              </SheetHeader>
              <div className="premium-scrollbar flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto px-6 py-6">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                    <dd className="mt-0.5 text-foreground">{statusLabel(preview.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Odbiorca</dt>
                    <dd className="mt-0.5 break-all text-foreground">{preview.recipient?.trim() || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Czas</dt>
                    <dd className="mt-0.5 tabular-nums text-foreground">
                      {dateFmt.format(new Date(eventTimeIso(preview)))}
                    </dd>
                  </div>
                  {preview.channel === "email" ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">Temat</dt>
                      <dd className="mt-0.5 text-foreground">{preview.subject?.trim() || "-"}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Treść</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-3 text-foreground">
                      {preview.body?.trim() ? (
                        preview.body
                      ) : (
                        <span className="text-muted-foreground">Brak zapisanej treści</span>
                      )}
                    </dd>
                  </div>
                  {errorLabel(preview.last_error) ? (
                    <div>
                      <dt className="text-xs font-medium text-destructive">Błąd / powód</dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-destructive">
                        {errorLabel(preview.last_error)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  )
}
