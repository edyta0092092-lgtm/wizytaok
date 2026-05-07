"use client"

import * as React from "react"
import Link from "next/link"
import { Send } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { EmptyState } from "@/components/shared/empty-state"
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
import { normalizePublicSlug } from "@/lib/business/slug"
import { getNotificationMessages } from "@/lib/notifications/notifications"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"
import type { NotificationMessage } from "@/types/domain"

type NotificationLogRow = Tables<"notification_logs">

type HistoryFilter = "all" | "sent" | "scheduled" | "failed" | "skipped"

type MergedEntry =
  | { kind: "db"; sortAt: string; row: NotificationLogRow }
  | { kind: "local"; sortAt: string; msg: NotificationMessage }

type PreviewTarget =
  | { kind: "db"; row: NotificationLogRow }
  | { kind: "local"; msg: NotificationMessage }

function dbChannel(row: NotificationLogRow): "sms" | "email" {
  const c = String(row.channel ?? "").trim().toLowerCase()
  return c === "email" ? "email" : "sms"
}

function mergeEntries(
  rows: NotificationLogRow[],
  local: NotificationMessage[]
): MergedEntry[] {
  const out: MergedEntry[] = []
  for (const row of rows) {
    out.push({ kind: "db", sortAt: row.created_at, row })
  }
  for (const msg of local) {
    out.push({ kind: "local", sortAt: msg.createdAt, msg })
  }
  out.sort(
    (a, b) =>
      new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
  )
  return out
}

function canonicalStatus(entry: MergedEntry): string {
  if (entry.kind === "db") {
    return entry.row.status.trim().toLowerCase()
  }
  if (entry.msg.status === "simulated") return "simulated_dev"
  return entry.msg.status
}

function statusTone(
  canon: string
): "success" | "danger" | "warning" | "neutral" {
  if (canon === "sent") return "success"
  if (canon === "failed") return "danger"
  if (
    canon === "skipped" ||
    canon === "not_configured" ||
    canon === "simulated_dev"
  ) {
    return "warning"
  }
  return "neutral"
}

function entryMatchesFilter(entry: MergedEntry, filter: HistoryFilter): boolean {
  if (filter === "all") return true
  const c = canonicalStatus(entry)
  if (filter === "sent") return c === "sent"
  if (filter === "scheduled") return c === "scheduled"
  if (filter === "failed") return c === "failed"
  if (filter === "skipped") return c === "skipped"
  return true
}

function listTypeLine(
  entry: MergedEntry,
  t: (key: string) => string
): string {
  const type =
    entry.kind === "db"
      ? String(entry.row.type ?? "").trim()
      : entry.msg.type
  const channel =
    entry.kind === "db" ? dbChannel(entry.row) : entry.msg.channel

  if (type === "manual_reminder") {
    return channel === "email"
      ? t("messagesLog.reminderEmailLine")
      : t("messagesLog.reminderSmsLine")
  }

  const chLabel = channel === "email" ? t("messages.email") : t("messages.sms")
  if (type === "booking_created") {
    return `${t("notifications.bookingCreatedType")} - ${chLabel}`
  }
  if (type === "booking_confirmed") {
    return `${t("notifications.bookingConfirmedType")} - ${chLabel}`
  }
  if (type === "reminder_24h" || type === "first_reminder_24h" || type === "appointment_reminder_24h") {
    return `${t("notifications.reminder24hType")} - ${chLabel}`
  }
  if (type === "second_reminder" || type === "appointment_reminder_short") {
    return `${t("notifications.secondReminderType")} - ${chLabel}`
  }
  if (type) return `${type} - ${chLabel}`
  return chLabel
}

function previewAsMerged(p: PreviewTarget): MergedEntry {
  if (p.kind === "db") {
    return { kind: "db", sortAt: p.row.created_at, row: p.row }
  }
  return { kind: "local", sortAt: p.msg.createdAt, msg: p.msg }
}

function safeFormatDate(
  raw: string | null | undefined,
  df: Intl.DateTimeFormat
): string {
  if (!raw?.trim()) return "-"
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return df.format(d)
}

function statusDisplay(
  canon: string,
  t: (key: string) => string
): string {
  switch (canon) {
    case "sent":
      return t("messagesLog.statusSent")
    case "scheduled":
      return t("messagesLog.statusScheduled")
    case "failed":
      return t("messagesLog.statusFailed")
    case "skipped":
      return t("messagesLog.statusSkipped")
    case "simulated_dev":
      return t("messagesLog.statusSimulation")
    case "not_configured":
      return t("messagesLog.statusNotConfigured")
    case "pending":
      return t("messagesLog.statusPending")
    default:
      return canon || t("messagesLog.statusPending")
  }
}

function localFailureDetail(
  msg: NotificationMessage,
  t: (key: string) => string
): string | null {
  if (msg.status !== "failed") return null
  if (msg.failureReason === "missing_phone")
    return t("notifications.failureReasonMissingPhone")
  if (msg.failureReason === "missing_email")
    return t("notifications.failureReasonMissingEmail")
  return null
}

function recipientDisplay(entry: PreviewTarget): string {
  if (entry.kind === "local") {
    const bits = [
      entry.msg.recipientPhone?.trim(),
      entry.msg.recipientEmail?.trim(),
    ].filter(Boolean)
    if (bits.length) return bits.join(" · ")
    return "-"
  }
  return entry.row.recipient?.trim() || "-"
}

function bodyForPreview(entry: PreviewTarget): string | null {
  if (entry.kind === "db") {
    const b = entry.row.body?.trim()
    return b || null
  }
  const b = entry.msg.body?.trim()
  return b || null
}

function subjectForPreview(entry: PreviewTarget): string | null {
  if (entry.kind === "db") {
    const s = entry.row.subject?.trim()
    return s || null
  }
  const s = entry.msg.subject?.trim()
  return s || null
}

function errorForPreview(entry: PreviewTarget, t: (k: string) => string): string | null {
  if (entry.kind === "db") {
    const st = entry.row.status.trim().toLowerCase()
    if (
      st === "failed" ||
      st === "skipped" ||
      st === "not_configured"
    ) {
      return entry.row.error?.trim() || null
    }
    return null
  }
  if (entry.msg.status === "failed") {
    return localFailureDetail(entry.msg, t)
  }
  return null
}

export function SendingHistorySection() {
  const { t, language } = useTranslations()
  const searchParams = useSearchParams()
  const logFilter = searchParams.get("filter")

  const [rows, setRows] = React.useState<NotificationLogRow[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [loadingDb, setLoadingDb] = React.useState(true)
  const [localMessages, setLocalMessages] = React.useState<NotificationMessage[]>([])
  const [businessSlugNorm, setBusinessSlugNorm] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<HistoryFilter>("all")
  const [preview, setPreview] = React.useState<PreviewTarget | null>(null)
  const [previewClientName, setPreviewClientName] = React.useState<string | null>(null)

  React.useEffect(() => {
    function refresh() {
      queueMicrotask(() => {
        setLocalMessages(getNotificationMessages())
      })
    }
    refresh()
    window.addEventListener("pw-notification-messages", refresh)
    return () => {
      window.removeEventListener("pw-notification-messages", refresh)
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isSupabaseConfigured()) {
        setLoadingDb(false)
        setRows([])
        setBusinessSlugNorm(null)
        setLoadError(null)
        return
      }
      const client = getBrowserClient()
      if (!client) {
        setLoadingDb(false)
        setLoadError("no_client")
        return
      }
      const bid = await getCurrentBusinessProfileIdForClient(client)
      if (!bid) {
        if (!cancelled) {
          setLoadingDb(false)
          setRows([])
          setBusinessSlugNorm(null)
        }
        return
      }
      const { data: bp } = await client
        .from("business_profiles")
        .select("slug")
        .eq("id", bid)
        .maybeSingle()
      const slugRaw = bp?.slug?.trim() ?? ""
      const slugNorm = slugRaw ? normalizePublicSlug(slugRaw) : null

      const { data, error: qErr } = await client
        .from("notification_logs")
        .select("*")
        .eq("business_id", bid)
        .order("created_at", { ascending: false })
        .limit(200)

      if (cancelled) return
      if (qErr) {
        setLoadError(qErr.message)
        setRows([])
      } else {
        setLoadError(null)
        setRows((data ?? []) as NotificationLogRow[])
      }
      setBusinessSlugNorm(slugNorm)
      setLoadingDb(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (logFilter !== "needs_attention") return
    const el = document.getElementById("messages-history-section")
    if (el) {
      queueMicrotask(() => {
        el.scrollIntoView({ block: "start", behavior: "smooth" })
      })
    }
  }, [logFilter])

  const scopedLocal = React.useMemo(() => {
    if (businessSlugNorm) {
      return localMessages.filter(
        (m) => normalizePublicSlug(m.businessSlug) === businessSlugNorm
      )
    }
    return localMessages
  }, [localMessages, businessSlugNorm])

  const merged = React.useMemo(
    () => mergeEntries(rows, scopedLocal),
    [rows, scopedLocal]
  )

  const tabFiltered = React.useMemo(
    () => merged.filter((e) => entryMatchesFilter(e, filter)),
    [merged, filter]
  )

  const listEntries = React.useMemo(() => {
    if (logFilter !== "needs_attention") return tabFiltered
    return tabFiltered.filter((e) => {
      const c = canonicalStatus(e)
      return c === "failed" || c === "scheduled"
    })
  }, [tabFiltered, logFilter])

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [language]
  )

  const bookingIdForPreview =
    preview?.kind === "db"
      ? preview.row.booking_id
      : preview?.kind === "local"
        ? preview.msg.bookingId
        : null

  React.useEffect(() => {
    if (!preview || preview.kind !== "db" || !bookingIdForPreview) {
      return
    }
    if (!isSupabaseConfigured()) {
      return
    }
    const client = getBrowserClient()
    if (!client) {
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await client
        .from("bookings")
        .select("client_name")
        .eq("id", bookingIdForPreview)
        .maybeSingle()
      if (!cancelled) {
        const name =
          data && typeof data.client_name === "string"
            ? data.client_name.trim()
            : ""
        setPreviewClientName(name || null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [preview, bookingIdForPreview])

  const previewOpen = Boolean(preview)

  const filterButtons: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: t("messagesLog.filterAll") },
    { id: "sent", label: t("messagesLog.filterSent") },
    { id: "scheduled", label: t("messagesLog.filterScheduled") },
    { id: "failed", label: t("messagesLog.filterFailed") },
    { id: "skipped", label: t("messagesLog.filterSkipped") },
  ]

  const showSupabaseHint = isSupabaseConfigured() === false
  const listLoading = loadingDb && isSupabaseConfigured()

  return (
    <section
      id="messages-history-section"
      className="mt-10 min-w-0 scroll-mt-24"
      aria-labelledby="messages-history-heading"
    >
      <h2
        id="messages-history-heading"
        className="mb-3 text-base font-semibold text-foreground"
      >
        {t("messagesLog.pageTitle")}
      </h2>

      {showSupabaseHint ? (
        <p className="mb-3 text-sm text-muted-foreground">
          {t("messagesLog.supabaseOptionalHint")}
        </p>
      ) : null}

      {loadError ? (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <Card className="rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
        <CardHeader className="space-y-3 pb-0">
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label={t("messagesLog.filtersAria")}
          >
            {filterButtons.map((b) => (
              <Button
                key={b.id}
                type="button"
                size="sm"
                variant={filter === b.id ? "default" : "outline"}
                className="h-9 rounded-full px-3 text-xs sm:text-sm"
                onClick={() => setFilter(b.id)}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {listLoading ? (
            <p className="text-sm text-muted-foreground">{t("messagesLog.loading")}</p>
          ) : listEntries.length === 0 ? (
            <div className="py-2">
              <EmptyState
                icon={Send}
                title={t("messagesLog.emptyHistoryTitle")}
                description={t("messagesLog.emptyHistoryDescription")}
                className="bg-transparent shadow-none"
              />
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {listEntries.map((entry) => {
                const key =
                  entry.kind === "db"
                    ? `db:${entry.row.id}`
                    : `local:${entry.msg.id}`
                const canon = canonicalStatus(entry)
                return (
                  <li key={key} className="min-h-[4.5rem] px-3 py-3 sm:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {listTypeLine(entry, t)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              semanticStatusBadgeClass(statusTone(canon))
                            )}
                          >
                            {statusDisplay(canon, t)}
                          </span>
                          <span className="tabular-nums">
                            {safeFormatDate(entry.sortAt, dateFmt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-9 w-full shrink-0 sm:w-auto"
                        onClick={() => {
                          setPreviewClientName(null)
                          setPreview(
                            entry.kind === "db"
                              ? { kind: "db", row: entry.row }
                              : { kind: "local", msg: entry.msg }
                          )
                        }}
                      >
                        {t("messages.messagePreview")}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={previewOpen}
        onOpenChange={(o) => {
          if (!o) {
            setPreview(null)
            setPreviewClientName(null)
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col border-border/80 bg-card p-0 sm:max-w-lg"
          showCloseButton
        >
          {preview ? (
            <>
              <SheetHeader className="space-y-1 border-b border-border/70 px-6 py-6 text-left">
                <SheetTitle className="font-heading text-lg">
                  {t("messages.messagePreview")}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {listTypeLine(previewAsMerged(preview), t)}
                </SheetDescription>
              </SheetHeader>
              <div className="premium-scrollbar flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto px-6 py-6">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldMessageType")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {listTypeLine(previewAsMerged(preview), t)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldChannel")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {(preview.kind === "db"
                        ? dbChannel(preview.row)
                        : preview.msg.channel) === "email"
                        ? t("messages.email")
                        : t("messages.sms")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldClient")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {preview.kind === "local"
                        ? preview.msg.recipientName || "-"
                        : previewClientName || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldRecipient")}
                    </dt>
                    <dd className="mt-0.5 break-all text-foreground">
                      {recipientDisplay(preview)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldStatus")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {statusDisplay(canonicalStatus(previewAsMerged(preview)), t)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldCreatedAt")}
                    </dt>
                    <dd className="mt-0.5 tabular-nums text-foreground">
                      {preview.kind === "db"
                        ? safeFormatDate(preview.row.created_at, dateFmt)
                        : safeFormatDate(preview.msg.createdAt, dateFmt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldSentAt")}
                    </dt>
                    <dd className="mt-0.5 tabular-nums text-foreground">
                      {preview.kind === "db"
                        ? safeFormatDate(preview.row.sent_at, dateFmt)
                        : preview.msg.sentAt
                          ? safeFormatDate(preview.msg.sentAt, dateFmt)
                          : safeFormatDate(preview.msg.scheduledFor, dateFmt)}
                    </dd>
                  </div>
                  {(preview.kind === "db" && dbChannel(preview.row) === "email") ||
                  (preview.kind === "local" && preview.msg.channel === "email") ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {t("messagesLog.fieldSubject")}
                      </dt>
                      <dd className="mt-0.5 text-foreground">
                        {subjectForPreview(preview) || "-"}
                      </dd>
                    </div>
                  ) : null}
                  {preview.kind === "local" &&
                  preview.msg.type === "manual_reminder" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("messagesLog.archivedManualSource")}
                    </p>
                  ) : null}
                  {preview.kind === "db" &&
                  String(preview.row.type ?? "").trim() ===
                    "manual_reminder" ? (
                    <p className="text-xs text-muted-foreground">
                      {t("messagesLog.archivedManualSource")}
                    </p>
                  ) : null}
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldBody")}
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/30 p-3 text-foreground">
                      {bodyForPreview(preview) ?? (
                        <span className="text-muted-foreground">
                          {t("messagesLog.noSavedBody")}
                        </span>
                      )}
                    </dd>
                  </div>
                  {errorForPreview(preview, t) ? (
                    <div>
                      <dt className="text-xs font-medium text-destructive">
                        {t("messagesLog.fieldError")}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-destructive">
                        {errorForPreview(preview, t)}
                      </dd>
                    </div>
                  ) : null}
                  {bookingIdForPreview ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {t("messagesLog.fieldRelatedAppointment")}
                      </dt>
                      <dd className="mt-0.5">
                        <Link
                          href="/appointments"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {t("messagesLog.relatedAppointmentLink")}
                        </Link>
                        <span className="ml-1 font-mono text-xs text-muted-foreground">
                          ({bookingIdForPreview})
                        </span>
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
