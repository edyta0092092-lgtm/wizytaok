"use client"

import * as React from "react"
import Link from "next/link"
import { Send } from "lucide-react"
import { useSearchParams } from "next/navigation"

import { TestNotificationsPanel } from "@/components/messages/test-notifications-panel"
import { FilterSelect } from "@/components/messages/filter-select"
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
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { normalizePublicSlug } from "@/lib/business/slug"
import { getNotificationMessages } from "@/lib/notifications/notifications"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"
import type { NotificationMessage } from "@/types/domain"

type NotificationLogRow = Tables<"notification_logs">

type HistoryFilter = "all" | "sent" | "scheduled" | "skipped"
type ChannelFilter = "all" | "sms" | "email"
type DateRangeFilter = "today" | "7d" | "30d" | "all"
type TypeFilter = "all" | string

type MergedEntry =
  | { kind: "db"; sortAt: string; row: NotificationLogRow }
  | { kind: "planned"; sortAt: string; row: PlannedReminderRow; channel: "sms" | "email"; reminderType: "reminder_24h" | "reminder_before_visit" }
  | { kind: "local"; sortAt: string; msg: NotificationMessage }

type PreviewTarget =
  | { kind: "db"; row: NotificationLogRow }
  | { kind: "planned"; row: PlannedReminderRow; channel: "sms" | "email"; reminderType: "reminder_24h" | "reminder_before_visit" }
  | { kind: "local"; msg: NotificationMessage }

type PlannedReminderRow = {
  id: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  appointment_date: string
  appointment_time: string
  first_reminder_due_at: string | null
  first_reminder_sent_at: string | null
  first_reminder_status: string | null
  second_reminder_due_at: string | null
  second_reminder_sent_at: string | null
  second_reminder_status: string | null
}

type PreviewBookingInfo = {
  id: string
  clientName: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  status: string
}

type LegacyPlannedReminderRow = {
  id: string
  client_name: string
  client_phone: string | null
  client_email: string | null
  appointment_date: string
  appointment_time: string
  reminder_sent_at: string | null
  reminder_status: string | null
}

function isMissingColumnInBookingsQuery(message: string | null | undefined): boolean {
  const m = String(message ?? "")
  return (
    /column .* does not exist/i.test(m) ||
    /could not find the ['"].*['"] column/i.test(m) ||
    /schema cache/i.test(m)
  )
}

function dbChannel(row: NotificationLogRow): "sms" | "email" {
  const c = String(row.channel ?? "").trim().toLowerCase()
  return c === "email" ? "email" : "sms"
}

function canonicalNotificationType(raw: string): string {
  const type = raw.trim()
  if (!type) return ""
  if (["reminder_24h", "first_reminder_24h", "appointment_reminder_24h", "reminder"].includes(type)) {
    return "reminder_24h"
  }
  if (["reminder_before_visit", "second_reminder", "appointment_reminder_short"].includes(type)) {
    return "reminder_before_visit"
  }
  if (["booking_confirmation", "booking_confirmed", "booking_created", "confirmation"].includes(type)) {
    return "booking_confirmation"
  }
  if (
    ["booking_cancelled_by_company", "company_cancelled_booking", "booking_cancelled_by_client", "client_cancelled_booking"].includes(
      type,
    )
  ) {
    return "booking_cancelled_by_company"
  }
  if (["no_show_follow_up", "followup_noshow", "follow_up_no_show"].includes(type)) {
    return "no_show_follow_up"
  }
  return type
}

function typeLabel(canonicalType: string, t: (key: string) => string): string {
  if (canonicalType === "reminder_24h") return t("notifications.reminder24hType")
  if (canonicalType === "reminder_before_visit") return t("notifications.secondReminderType")
  if (canonicalType === "booking_confirmation") return t("notifications.bookingConfirmedType")
  if (canonicalType === "booking_cancelled_by_company") return "Anulowanie wizyty"
  if (canonicalType === "no_show_follow_up") return "Follow-up po nieobecności"
  if (canonicalType === "integration_test") return t("messagesLog.integrationTestLine")
  return canonicalType
}

function mergeEntries(
  rows: NotificationLogRow[],
  local: NotificationMessage[],
  planned: PlannedReminderRow[]
): MergedEntry[] {
  const out: MergedEntry[] = []
  for (const row of rows) {
    out.push({ kind: "db", sortAt: row.created_at, row })
  }
  for (const row of planned) {
    const startIso = `${row.appointment_date}T${String(row.appointment_time).slice(0, 5)}:00`
    const startMs = new Date(startIso).getTime()
    const firstDue =
      row.first_reminder_due_at && row.first_reminder_due_at.trim()
        ? row.first_reminder_due_at
        : Number.isNaN(startMs)
          ? startIso
          : new Date(startMs - 24 * 60 * 60 * 1000).toISOString()
    const secondDue =
      row.second_reminder_due_at && row.second_reminder_due_at.trim()
        ? row.second_reminder_due_at
        : Number.isNaN(startMs)
          ? startIso
          : new Date(startMs - 60 * 60 * 1000).toISOString()
    const firstStatus = String(row.first_reminder_status ?? "").trim().toLowerCase()
    const secondStatus = String(row.second_reminder_status ?? "").trim().toLowerCase()
    const firstPending =
      row.first_reminder_sent_at == null &&
      (firstStatus === "" || firstStatus === "pending" || firstStatus === "queued" || firstStatus === "scheduled")
    const secondPending =
      row.second_reminder_sent_at == null &&
      (secondStatus === "" || secondStatus === "pending" || secondStatus === "queued" || secondStatus === "scheduled")
    if (firstPending) {
      if (row.client_phone?.trim()) {
        out.push({
          kind: "planned",
          sortAt: firstDue,
          row,
          channel: "sms",
          reminderType: "reminder_24h",
        })
      }
      if (row.client_email?.trim()) {
        out.push({
          kind: "planned",
          sortAt: firstDue,
          row,
          channel: "email",
          reminderType: "reminder_24h",
        })
      }
    }
    if (secondPending) {
      if (row.client_phone?.trim()) {
        out.push({
          kind: "planned",
          sortAt: secondDue,
          row,
          channel: "sms",
          reminderType: "reminder_before_visit",
        })
      }
      if (row.client_email?.trim()) {
        out.push({
          kind: "planned",
          sortAt: secondDue,
          row,
          channel: "email",
          reminderType: "reminder_before_visit",
        })
      }
    }
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
  if (entry.kind === "planned") return "scheduled"
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
  const isMissingContactSkip = (() => {
    if (entry.kind === "db") {
      const err = String(entry.row.error_message ?? "").toLowerCase()
      return (
        (c === "skipped" || c === "failed") &&
        (err.includes("missing client contact") ||
          err.includes("missing phone") ||
          err.includes("missing email") ||
          err.includes("brak numeru") ||
          err.includes("brak telefonu") ||
          err.includes("brak e-mail"))
      )
    }
    if (entry.kind === "local") {
      return (
        entry.msg.status === "failed" &&
        (entry.msg.failureReason === "missing_phone" || entry.msg.failureReason === "missing_email")
      )
    }
    return false
  })()
  if (filter === "sent") return c === "sent"
  if (filter === "scheduled") return entry.kind === "planned" && c === "scheduled"
  if (filter === "skipped") {
    return c === "skipped" || c === "not_configured" || isMissingContactSkip
  }
  return true
}

function listTypeLine(
  entry: MergedEntry,
  t: (key: string) => string
): string {
  const rawType =
    entry.kind === "db"
      ? String(entry.row.type ?? "").trim()
      : entry.kind === "planned"
        ? entry.reminderType
      : entry.msg.type
  const type = canonicalNotificationType(rawType)
  const channel =
    entry.kind === "db" ? dbChannel(entry.row) : entry.kind === "planned" ? entry.channel : entry.msg.channel

  if (rawType === "manual_reminder") {
    return channel === "email"
      ? t("messagesLog.reminderEmailLine")
      : t("messagesLog.reminderSmsLine")
  }

  const chLabel = channel === "email" ? t("messages.email") : t("messages.sms")
  if (type) return `${typeLabel(type, t)} - ${chLabel}`
  return chLabel
}

function previewAsMerged(p: PreviewTarget): MergedEntry {
  if (p.kind === "db") {
    return { kind: "db", sortAt: p.row.created_at, row: p.row }
  }
  if (p.kind === "planned") {
    return { kind: "planned", sortAt: p.row.first_reminder_due_at ?? p.row.appointment_date, row: p.row, channel: p.channel, reminderType: p.reminderType }
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
    case "queued":
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
  if (entry.kind === "planned") {
    const v = entry.channel === "email" ? entry.row.client_email : entry.row.client_phone
    return v?.trim() || "-"
  }
  return entry.row.recipient?.trim() || "-"
}

function bodyForPreview(entry: PreviewTarget): string | null {
  if (entry.kind === "planned") return null
  if (entry.kind === "db") {
    const b = entry.row.body?.trim()
    return b || null
  }
  const b = entry.msg.body?.trim()
  return b || null
}

function subjectForPreview(entry: PreviewTarget): string | null {
  if (entry.kind === "planned") return null
  if (entry.kind === "db") {
    const s = entry.row.subject?.trim()
    return s || null
  }
  const s = entry.msg.subject?.trim()
  return s || null
}

function plannedAtIso(entry: { row: PlannedReminderRow; reminderType: "reminder_24h" | "reminder_before_visit" }): string {
  const startIso = `${entry.row.appointment_date}T${String(entry.row.appointment_time).slice(0, 5)}:00`
  const startMs = new Date(startIso).getTime()
  if (entry.reminderType === "reminder_24h") {
    if (entry.row.first_reminder_due_at?.trim()) return entry.row.first_reminder_due_at
    return Number.isNaN(startMs) ? startIso : new Date(startMs - 24 * 60 * 60 * 1000).toISOString()
  }
  if (entry.row.second_reminder_due_at?.trim()) return entry.row.second_reminder_due_at
  return Number.isNaN(startMs) ? startIso : new Date(startMs - 60 * 60 * 1000).toISOString()
}

function humanizeSkipReason(raw: string): string {
  switch (raw.trim()) {
    case "template_disabled":
      return "Szablon wyłączony dla tego kanału"
    case "booking_cancelled":
      return "Wizyta anulowana przed wysyłką"
    case "Missing client contact details":
      return "Brak danych kontaktowych klienta"
    default:
      return raw
  }
}

function errorForPreview(entry: PreviewTarget, t: (k: string) => string): string | null {
  if (entry.kind === "planned") return null
  if (entry.kind === "db") {
    const st = entry.row.status.trim().toLowerCase()
    if (
      st === "failed" ||
      st === "skipped" ||
      st === "not_configured"
    ) {
      const raw = entry.row.error_message?.trim()
      return raw ? humanizeSkipReason(raw) : null
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
  const access = useBusinessAccess()
  const searchParams = useSearchParams()
  const logFilter = searchParams.get("filter")

  const [rows, setRows] = React.useState<NotificationLogRow[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [loadingDb, setLoadingDb] = React.useState(true)
  const [plannedRows, setPlannedRows] = React.useState<PlannedReminderRow[]>([])
  const [templateTypes, setTemplateTypes] = React.useState<string[]>([])
  const [localMessages, setLocalMessages] = React.useState<NotificationMessage[]>([])
  const [businessSlugNorm, setBusinessSlugNorm] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<HistoryFilter>("all")
  const [channelFilter, setChannelFilter] = React.useState<ChannelFilter>("all")
  const [dateRange, setDateRange] = React.useState<DateRangeFilter>("30d")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")
  const [preview, setPreview] = React.useState<PreviewTarget | null>(null)
  const [previewBookingInfo, setPreviewBookingInfo] = React.useState<PreviewBookingInfo | null>(null)
  const [integrationFlags, setIntegrationFlags] = React.useState<{
    enableTestNotifications: boolean
    enableTestBilling: boolean
  } | null>(null)
  const [logRefreshTick, setLogRefreshTick] = React.useState(0)
  const historyLoadedRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/config/test-integrations", { cache: "no-store" })
        const data = (await res.json()) as {
          testNotificationsEnabled?: boolean
          enableTestNotifications?: boolean
          testBillingEnabled?: boolean
          enableTestBilling?: boolean
        }
        if (!cancelled) {
          setIntegrationFlags({
            enableTestNotifications:
              data.testNotificationsEnabled === true ||
              data.enableTestNotifications === true,
            enableTestBilling:
              data.testBillingEnabled === true || data.enableTestBilling === true,
          })
        }
      } catch {
        if (!cancelled) {
          setIntegrationFlags({
            enableTestNotifications: false,
            enableTestBilling: false,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
    if (!access.ready) return
    let cancelled = false
    void (async () => {
      const showBlocking = !historyLoadedRef.current
      if (showBlocking) setLoadingDb(true)
      if (!isSupabaseConfigured()) {
        setLoadingDb(false)
        setRows([])
        setBusinessSlugNorm(null)
        setLoadError(null)
        return
      }
      const client = getBrowserClient()
      const bid = access.businessId
      if (!client) {
        setLoadingDb(false)
        setLoadError("no_client")
        return
      }
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

      const [{ data, error: qErr }, { data: templateRows }] = await Promise.all([
        client
          .from("notification_logs")
          .select("*")
          .eq("business_id", bid)
          .order("created_at", { ascending: false })
          .limit(200),
        client.from("message_templates").select("type").eq("business_id", bid),
      ])

      const { data: planData, error: planErr } = await client
        .from("bookings")
        .select(
          "id,client_name,client_phone,client_email,appointment_date,appointment_time,first_reminder_due_at,first_reminder_sent_at,first_reminder_status,second_reminder_due_at,second_reminder_sent_at,second_reminder_status,status"
        )
        .eq("business_id", bid)
        .in("status", ["booked", "pending", "confirmed"])

      let plannedRowsResolved: PlannedReminderRow[] = []
      let plannedError = planErr
      if (!planErr) {
        plannedRowsResolved = (planData ?? []) as PlannedReminderRow[]
      } else if (isMissingColumnInBookingsQuery(planErr.message)) {
        const { data: legacyPlanData, error: legacyPlanErr } = await client
          .from("bookings")
          .select(
            "id,client_name,client_phone,client_email,appointment_date,appointment_time,reminder_sent_at,reminder_status,status"
          )
          .eq("business_id", bid)
          .in("status", ["booked", "pending", "confirmed"])
        if (!legacyPlanErr) {
          plannedRowsResolved = ((legacyPlanData ?? []) as LegacyPlannedReminderRow[]).map((row) => ({
            id: row.id,
            client_name: row.client_name,
            client_phone: row.client_phone,
            client_email: row.client_email,
            appointment_date: row.appointment_date,
            appointment_time: row.appointment_time,
            first_reminder_due_at: null,
            first_reminder_sent_at: row.reminder_sent_at ?? null,
            first_reminder_status: row.reminder_status ?? null,
            second_reminder_due_at: null,
            second_reminder_sent_at: null,
            second_reminder_status: "sent",
          }))
          plannedError = null
        } else {
          plannedError = legacyPlanErr
        }
      }
      if (plannedError && isMissingColumnInBookingsQuery(plannedError.message)) {
        const { data: minimalPlanData, error: minimalPlanErr } = await client
          .from("bookings")
          .select("id,client_name,client_phone,client_email,appointment_date,appointment_time,status")
          .eq("business_id", bid)
          .in("status", ["booked", "pending", "confirmed"])
        if (!minimalPlanErr) {
          plannedRowsResolved = ((minimalPlanData ?? []) as Array<
            Pick<
              PlannedReminderRow,
              "id" | "client_name" | "client_phone" | "client_email" | "appointment_date" | "appointment_time"
            >
          >).map((row) => ({
            id: row.id,
            client_name: row.client_name,
            client_phone: row.client_phone,
            client_email: row.client_email,
            appointment_date: row.appointment_date,
            appointment_time: row.appointment_time,
            first_reminder_due_at: null,
            first_reminder_sent_at: null,
            first_reminder_status: "pending",
            second_reminder_due_at: null,
            second_reminder_sent_at: null,
            second_reminder_status: "pending",
          }))
          plannedError = null
        } else {
          plannedError = minimalPlanErr
        }
      }

      if (cancelled) return
      if (qErr) {
        setLoadError(qErr.message)
        setRows([])
        setPlannedRows([])
        setTemplateTypes([])
      } else {
        setLoadError(null)
        setRows((data ?? []) as NotificationLogRow[])
        if (!plannedError) {
          setPlannedRows(plannedRowsResolved)
        } else {
          setPlannedRows([])
        }
        const nextTemplateTypes = Array.from(
          new Set(
            (templateRows ?? [])
              .map((row) => canonicalNotificationType(String((row as { type?: string }).type ?? "").trim()))
              .filter(Boolean),
          ),
        )
        setTemplateTypes(nextTemplateTypes)
        if (process.env.NODE_ENV === "development") {
          console.info("[notifications.logs.load]", {
            businessId: bid,
            count: (data ?? []).length,
            plannedCount: plannedRowsResolved.length,
            error: plannedError?.message ?? null,
          })
        }
      }
      if (process.env.NODE_ENV === "development" && qErr) {
        console.info("[notifications.logs.load]", {
          businessId: bid,
          count: 0,
          error: qErr.message,
        })
      }
      setBusinessSlugNorm(slugNorm)
      if (!cancelled) {
        historyLoadedRef.current = true
        setLoadingDb(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [access.ready, access.businessId, logRefreshTick])

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
    () => mergeEntries(rows, scopedLocal, plannedRows),
    [rows, scopedLocal, plannedRows]
  )

  const availableTypeFilters = React.useMemo(() => {
    const fromEntries = merged.map((entry) => {
      const raw =
        entry.kind === "db"
          ? String(entry.row.type ?? "").trim()
          : entry.kind === "planned"
            ? entry.reminderType
            : String(entry.msg.type ?? "").trim()
      return canonicalNotificationType(raw)
    })
    const values = Array.from(new Set([...templateTypes, ...fromEntries].filter(Boolean)))
    return values
  }, [merged, templateTypes])

  const [nowMs] = React.useState<number>(() => new Date().getTime())

  const tabFiltered = React.useMemo(() => {
    const sinceMs =
      filter === "scheduled"
        ? null
        : dateRange === "today"
        ? nowMs - 24 * 60 * 60 * 1000
        : dateRange === "7d"
          ? nowMs - 7 * 24 * 60 * 60 * 1000
          : dateRange === "30d"
            ? nowMs - 30 * 24 * 60 * 60 * 1000
            : null
    return merged
      .filter((e) => entryMatchesFilter(e, filter))
      .filter((e) => {
        if (channelFilter === "all") return true
        const c = e.kind === "db" ? dbChannel(e.row) : e.kind === "planned" ? e.channel : e.msg.channel
        return c === channelFilter
      })
      .filter((e) => {
        if (sinceMs == null) return true
        return new Date(e.sortAt).getTime() >= sinceMs
      })
      .filter((e) => {
        if (typeFilter === "all") return true
        const resolvedType =
          e.kind === "db"
            ? String(e.row.type ?? "").trim()
            : e.kind === "planned"
              ? e.reminderType
              : String(e.msg.type)
        return canonicalNotificationType(resolvedType) === typeFilter
      })
  }, [merged, filter, channelFilter, dateRange, typeFilter, nowMs])

  React.useEffect(() => {
    if (typeFilter === "all") return
    if (!availableTypeFilters.includes(typeFilter)) {
      setTypeFilter("all")
    }
  }, [typeFilter, availableTypeFilters])

  const listEntries = React.useMemo(() => {
    if (logFilter === "failed") {
      return tabFiltered.filter((e) => canonicalStatus(e) === "failed")
    }
    if (logFilter !== "needs_attention") return tabFiltered
    return tabFiltered.filter((e) => {
      const c = canonicalStatus(e)
      return c === "failed" || c === "scheduled" || c === "queued" || c === "pending"
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
      : preview?.kind === "planned"
        ? preview.row.id
      : preview?.kind === "local"
        ? preview.msg.bookingId
        : null

  React.useEffect(() => {
    if (!preview || !bookingIdForPreview) {
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
        .select("id,client_name,service_name,appointment_date,appointment_time,status")
        .eq("id", bookingIdForPreview)
        .maybeSingle()
      if (!cancelled) {
        if (!data) {
          setPreviewBookingInfo(null)
          return
        }
        setPreviewBookingInfo({
          id: String(data.id ?? bookingIdForPreview),
          clientName: typeof data.client_name === "string" ? data.client_name.trim() : "",
          serviceName: typeof data.service_name === "string" ? data.service_name.trim() : "",
          appointmentDate:
            typeof data.appointment_date === "string"
              ? String(data.appointment_date).slice(0, 10)
              : "",
          appointmentTime:
            typeof data.appointment_time === "string"
              ? String(data.appointment_time).slice(0, 5)
              : "",
          status: typeof data.status === "string" ? data.status.trim() : "",
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [preview, bookingIdForPreview])

  const relatedStatusLabel = React.useMemo(() => {
    const raw = (previewBookingInfo?.status ?? "").toLowerCase()
    if (!raw) return "-"
    if (raw === "booked") return "Zarezerwowana"
    if (raw === "pending") return "Do potwierdzenia"
    if (raw === "confirmed") return "Potwierdzona"
    if (raw === "cancelled") return "Anulowana"
    if (raw === "completed") return "Zrealizowana"
    if (raw === "no_show") return "Nieobecność"
    return raw
  }, [previewBookingInfo?.status])

  const previewOpen = Boolean(preview)

  const filterButtons: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: t("messagesLog.filterAll") },
    { id: "sent", label: t("messagesLog.filterSent") },
    { id: "scheduled", label: t("messagesLog.filterScheduled") },
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

      {access.ready &&
      access.effectiveRole === "admin" &&
      integrationFlags?.enableTestNotifications ? (
        <TestNotificationsPanel
          flags={{ enableTestNotifications: true }}
          onSent={() => setLogRefreshTick((n) => n + 1)}
        />
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
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              aria-label="Filtr kanału"
              value={channelFilter}
              onChange={(v) => setChannelFilter(v as ChannelFilter)}
            >
              <option value="all">Wszystkie kanały</option>
              <option value="sms">{t("messages.sms")}</option>
              <option value="email">{t("messages.email")}</option>
            </FilterSelect>
            <FilterSelect
              aria-label="Zakres dat"
              value={dateRange}
              onChange={(v) => setDateRange(v as DateRangeFilter)}
            >
              <option value="today">Dzisiaj</option>
              <option value="7d">7 dni</option>
              <option value="30d">30 dni</option>
              <option value="all">Wszystkie</option>
            </FilterSelect>
            <FilterSelect
              aria-label="Filtr typu"
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
            >
              <option value="all">Wszystkie typy</option>
              {availableTypeFilters.map((type) => (
                <option key={type} value={type}>
                  {typeLabel(type, t)}
                </option>
              ))}
            </FilterSelect>
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
            <ul className="premium-scrollbar max-h-[500px] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {listEntries.map((entry) => {
                const key =
                  entry.kind === "db"
                    ? `db:${entry.row.id}`
                    : entry.kind === "planned"
                      ? `planned:${entry.row.id}:${entry.reminderType}:${entry.channel}`
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
                          setPreviewBookingInfo(null)
                          setPreview(
                            entry.kind === "db"
                              ? { kind: "db", row: entry.row }
                              : entry.kind === "planned"
                                ? { kind: "planned", row: entry.row, channel: entry.channel, reminderType: entry.reminderType }
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
            setPreviewBookingInfo(null)
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
                        : preview.kind === "planned"
                          ? preview.channel
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
                        : preview.kind === "planned"
                          ? preview.row.client_name || "-"
                          : preview.kind === "db" &&
                              (!preview.row.booking_id ||
                                String(preview.row.type ?? "").trim() === "integration_test")
                            ? t("messagesLog.fieldClientIntegrationTest")
                            : previewBookingInfo?.clientName || "-"}
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
                        : preview.kind === "planned"
                          ? safeFormatDate(plannedAtIso(preview), dateFmt)
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
                        : preview.kind === "planned"
                          ? safeFormatDate(plannedAtIso(preview), dateFmt)
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
                      <dd className="mt-0.5 space-y-1">
                        <Link
                          href="/appointments"
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {t("messagesLog.relatedAppointmentLink")}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {previewBookingInfo?.appointmentDate || "-"} {previewBookingInfo?.appointmentTime || ""}
                          {" · "}
                          {previewBookingInfo?.serviceName || "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">Status: {relatedStatusLabel}</p>
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
