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
import { reminderLogTypeFromKind } from "@/lib/notifications/reminder-notification-log"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"
import { formatDeliveryError } from "@/lib/messages/delivery-error-label"
import {
  customTemplateFilterKey,
  customTemplateIdFromFilterKey,
  isCustomTemplateFilterKey,
  STANDARD_MESSAGE_TEMPLATE_TYPES,
} from "@/lib/messages/history-template-filters"
import {
  loadNotificationPreviewDetails,
  type NotificationPreviewDetails,
  type NotificationPreviewTarget,
} from "@/lib/messages/notification-history-preview"
import { reminderHistoryTypeLabel } from "@/lib/messages/reminder-settings-from-templates"
import { cn } from "@/lib/utils"
import type { Tables } from "@/types/database"
import type { NotificationMessage } from "@/types/domain"

type NotificationLogRow = Tables<"notification_logs">
type CustomTemplateSendRow = Tables<"custom_template_sends">
type CustomTemplateRow = Pick<
  Tables<"custom_templates">,
  "id" | "name" | "trigger_type" | "offset_minutes" | "sms_enabled" | "email_enabled"
>

const TRANSACTIONAL_HISTORY_TYPES = new Set([
  "booking_confirmation",
  "booking_created",
  "booking_cancelled_by_company",
  "booking_cancelled_by_client",
  "no_show_follow_up",
])

type HistoryFilter = "all" | "sent" | "scheduled" | "skipped"
type ChannelFilter = "all" | "sms" | "email"
type DateRangeFilter = "today" | "7d" | "30d" | "all"
type TypeFilter = "all" | string

type MergedEntry =
  | { kind: "db"; sortAt: string; row: NotificationLogRow }
  | { kind: "planned"; sortAt: string; row: PlannedReminderRow; channel: "sms" | "email"; reminderType: "reminder_24h" | "reminder_before_visit" }
  | {
      kind: "reminderOutcome"
      sortAt: string
      row: PlannedReminderRow
      channel: "sms" | "email"
      reminderType: "reminder_24h" | "reminder_before_visit"
      outcomeStatus: string
    }
  | { kind: "local"; sortAt: string; msg: NotificationMessage }
  | { kind: "customSend"; sortAt: string; row: CustomTemplateSendRow; channel: "sms" | "email" }
  | {
      kind: "plannedCustom"
      sortAt: string
      row: PlannedReminderRow
      channel: "sms" | "email"
      templateId: string
    }

type PreviewTarget =
  | { kind: "db"; row: NotificationLogRow }
  | { kind: "planned"; row: PlannedReminderRow; channel: "sms" | "email"; reminderType: "reminder_24h" | "reminder_before_visit" }
  | {
      kind: "reminderOutcome"
      row: PlannedReminderRow
      channel: "sms" | "email"
      reminderType: "reminder_24h" | "reminder_before_visit"
      outcomeStatus: string
    }
  | { kind: "local"; msg: NotificationMessage }
  | { kind: "customSend"; row: CustomTemplateSendRow; channel: "sms" | "email" }
  | {
      kind: "plannedCustom"
      row: PlannedReminderRow
      channel: "sms" | "email"
      templateId: string
    }

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

type AppointmentReminderQueueRow = {
  appointment_id: string
  channel: string
  reminder_kind: string
  status: string
  scheduled_for: string
  sent_at: string | null
  created_at: string | null
}

function queueLookupKey(
  appointmentId: string,
  reminderType: "reminder_24h" | "reminder_before_visit",
  channel: "sms" | "email",
): string {
  const kind = reminderType === "reminder_24h" ? "first" : "second"
  return `${appointmentId}:${kind}:${channel}`
}

function buildQueueStatusMap(rows: AppointmentReminderQueueRow[]): Map<string, AppointmentReminderQueueRow> {
  const map = new Map<string, AppointmentReminderQueueRow>()
  for (const row of rows) {
    const kind = row.reminder_kind.trim().toLowerCase()
    const reminderType = kind === "second" ? "reminder_before_visit" : "reminder_24h"
    const channel = row.channel.trim().toLowerCase() === "email" ? "email" : "sms"
    map.set(queueLookupKey(row.appointment_id, reminderType, channel), row)
  }
  return map
}

function isQueueChannelSettled(row: AppointmentReminderQueueRow | undefined): boolean {
  if (!row) return false
  const status = row.status.trim().toLowerCase()
  return status === "sent" || status === "skipped" || status === "failed"
}

async function loadAppointmentReminderQueueRows(
  client: NonNullable<ReturnType<typeof getBrowserClient>>,
  businessId: string,
): Promise<AppointmentReminderQueueRow[]> {
  const { data, error } = await client
    .from("appointment_reminders")
    .select("appointment_id,channel,reminder_kind,status,scheduled_for,sent_at,created_at")
    .eq("business_id", businessId)
  if (error || !data) return []
  return data as AppointmentReminderQueueRow[]
}

type PreviewBookingInfo = {
  id: string
  clientName: string
  serviceName: string
  appointmentDate: string
  appointmentTime: string
  status: string
  createdAt: string | null
  confirmedAt: string | null
  updatedAt: string | null
  lastStatusChangeSource: string | null
  confirmationToken: string | null
  staffName: string | null
}

type PreviewBusinessInfo = {
  business_name: string | null
  slug: string | null
  phone: string | null
  contact_phone: string | null
  business_address: string | null
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

function mapLegacyPlannedReminderRow(row: LegacyPlannedReminderRow): PlannedReminderRow {
  return {
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
  }
}

async function loadNotificationLogRows(
  client: NonNullable<ReturnType<typeof getBrowserClient>>,
  businessId: string,
): Promise<{ rows: NotificationLogRow[]; error: string | null }> {
  const logsRes = await fetch("/api/messages/notification-logs", {
    cache: "no-store",
    credentials: "include",
  })
  const logsJson = (await logsRes.json().catch(() => ({}))) as {
    ok?: boolean
    rows?: NotificationLogRow[]
    error?: string
  }
  if (logsRes.ok && logsJson.ok === true) {
    return { rows: logsJson.rows ?? [], error: null }
  }

  const { data, error } = await client
    .from("notification_logs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200)
  if (!error) {
    return { rows: (data ?? []) as NotificationLogRow[], error: null }
  }

  return {
    rows: [],
    error: logsJson.error ?? error.message ?? `http_${logsRes.status}`,
  }
}

async function loadSentReminderHistoryRows(
  client: NonNullable<ReturnType<typeof getBrowserClient>>,
  businessId: string,
): Promise<PlannedReminderRow[]> {
  const { data: historyData, error: historyErr } = await client
    .from("bookings")
    .select(
      "id,client_name,client_phone,client_email,appointment_date,appointment_time,first_reminder_due_at,first_reminder_sent_at,first_reminder_status,second_reminder_due_at,second_reminder_sent_at,second_reminder_status,status"
    )
    .eq("business_id", businessId)
    .or("first_reminder_sent_at.not.is.null,second_reminder_sent_at.not.is.null")
    .order("updated_at", { ascending: false })
    .limit(200)
  if (!historyErr) {
    return (historyData ?? []) as PlannedReminderRow[]
  }
  if (!isMissingColumnInBookingsQuery(historyErr.message)) {
    return []
  }

  const { data: legacyHistory, error: legacyHistoryErr } = await client
    .from("bookings")
    .select(
      "id,client_name,client_phone,client_email,appointment_date,appointment_time,reminder_sent_at,reminder_status,status"
    )
    .eq("business_id", businessId)
    .not("reminder_sent_at", "is", null)
    .order("updated_at", { ascending: false })
    .limit(200)
  if (legacyHistoryErr) {
    return []
  }
  return ((legacyHistory ?? []) as LegacyPlannedReminderRow[]).map(mapLegacyPlannedReminderRow)
}

async function loadSentAppointmentReminderLogRows(
  client: NonNullable<ReturnType<typeof getBrowserClient>>,
  businessId: string,
): Promise<NotificationLogRow[]> {
  const { data, error } = await client
    .from("appointment_reminders")
    .select(
      "id,business_id,appointment_id,channel,reminder_kind,status,sent_at,created_at,last_error,provider,provider_message_id",
    )
    .eq("business_id", businessId)
    .in("status", ["sent", "failed", "skipped"])
    .order("sent_at", { ascending: false })
    .limit(200)
  if (error || !data) return []

  return (data as Array<{
    id: string
    business_id: string
    appointment_id: string
    channel: string
    reminder_kind: string
    status: string
    sent_at: string | null
    created_at: string
    last_error: string | null
    provider: string | null
    provider_message_id: string | null
  }>).map((row) => ({
    id: `queue-${row.id}`,
    business_id: row.business_id,
    booking_id: row.appointment_id,
    channel: row.channel,
    type: reminderLogTypeFromKind(row.reminder_kind),
    recipient: null,
    status: row.status,
    subject: null,
    body: null,
    provider: row.provider,
    provider_message_id: row.provider_message_id,
    error_message: row.last_error,
    sent_at: row.sent_at,
    created_at: row.sent_at ?? row.created_at,
  })) as NotificationLogRow[]
}

function mergeLogRowsWithQueueHistory(
  logRows: NotificationLogRow[],
  queueRows: NotificationLogRow[],
): NotificationLogRow[] {
  if (queueRows.length === 0) return logRows
  const existingKeys = buildLogDedupKeys(logRows)
  const merged = [...logRows]
  for (const row of queueRows) {
    if (!row.booking_id) {
      merged.push(row)
      continue
    }
    const key = `${row.booking_id}:${canonicalNotificationType(String(row.type ?? ""))}:${dbChannel(row)}`
    if (!existingKeys.has(key)) {
      merged.push(row)
      existingKeys.add(key)
    }
  }
  return merged
}

function mapPreviewBookingRow(
  bookingData: Record<string, unknown>,
  bookingId: string,
): PreviewBookingInfo {
  return {
    id: String(bookingData.id ?? bookingId),
    clientName:
      typeof bookingData.client_name === "string" ? bookingData.client_name.trim() : "",
    serviceName:
      typeof bookingData.service_name === "string" ? bookingData.service_name.trim() : "",
    appointmentDate:
      typeof bookingData.appointment_date === "string"
        ? String(bookingData.appointment_date).slice(0, 10)
        : "",
    appointmentTime:
      typeof bookingData.appointment_time === "string"
        ? String(bookingData.appointment_time).slice(0, 5)
        : "",
    status: typeof bookingData.status === "string" ? bookingData.status.trim() : "",
    createdAt: typeof bookingData.created_at === "string" ? bookingData.created_at : null,
    confirmedAt: typeof bookingData.confirmed_at === "string" ? bookingData.confirmed_at : null,
    updatedAt: typeof bookingData.updated_at === "string" ? bookingData.updated_at : null,
    lastStatusChangeSource:
      typeof bookingData.last_status_change_source === "string"
        ? bookingData.last_status_change_source.trim()
        : null,
    confirmationToken:
      typeof bookingData.confirmation_token === "string"
        ? bookingData.confirmation_token.trim()
        : null,
    staffName:
      typeof bookingData.staff_name === "string" ? bookingData.staff_name.trim() : null,
  }
}

async function loadPreviewBookingInfo(
  client: NonNullable<ReturnType<typeof getBrowserClient>>,
  bookingId: string,
): Promise<PreviewBookingInfo | null> {
  const selects = [
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,updated_at,last_status_change_source,confirmation_token,staff_name",
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,confirmation_token,staff_name",
    "id,client_name,service_name,appointment_date,appointment_time,status,created_at,staff_name",
  ]

  for (const select of selects) {
    const { data, error } = await client
      .from("bookings")
      .select(select)
      .eq("id", bookingId)
      .maybeSingle()

    if (!error && data) {
      return mapPreviewBookingRow(data as unknown as Record<string, unknown>, bookingId)
    }
    if (!isMissingColumnInBookingsQuery(error?.message)) {
      break
    }
  }

  return null
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

function customSendChannel(row: CustomTemplateSendRow): "sms" | "email" {
  return String(row.channel ?? "").trim().toLowerCase() === "email" ? "email" : "sms"
}

function customSendSortAt(row: CustomTemplateSendRow): string {
  return row.sent_at ?? row.failed_at ?? row.skipped_at ?? row.created_at
}

function isScheduledCustomTrigger(triggerType: string): boolean {
  const t = triggerType.trim()
  return t === "schedule_before" || t === "schedule_after"
}

function customTemplateById(
  templates: CustomTemplateRow[],
): Map<string, CustomTemplateRow> {
  return new Map(templates.map((row) => [row.id, row]))
}

function customSendDedupKey(
  appointmentId: string,
  templateId: string,
  channel: "sms" | "email",
): string {
  return `${appointmentId}:${templateId}:${channel}`
}

function buildSettledCustomSendKeys(rows: CustomTemplateSendRow[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    const st = String(row.status ?? "").trim().toLowerCase()
    if (st === "sent" || st === "failed" || st === "skipped" || st === "processing") {
      keys.add(customSendDedupKey(row.appointment_id, row.custom_template_id, customSendChannel(row)))
    }
  }
  return keys
}

function shouldIncludeCustomSendRow(
  row: CustomTemplateSendRow,
  templateById: Map<string, CustomTemplateRow>,
): boolean {
  const st = String(row.status ?? "").trim().toLowerCase()
  if (st === "sent" || st === "failed" || st === "skipped") return true
  const trigger = templateById.get(row.custom_template_id)?.trigger_type ?? ""
  return isScheduledCustomTrigger(trigger) && (st === "pending" || st === "processing")
}

function computeCustomTemplateTriggerIso(
  row: PlannedReminderRow,
  template: CustomTemplateRow,
): string | null {
  if (template.offset_minutes == null) return null
  const startIso = `${row.appointment_date}T${String(row.appointment_time).slice(0, 5)}:00`
  const startMs = new Date(startIso).getTime()
  if (Number.isNaN(startMs)) return null
  const offsetMs = template.offset_minutes * 60 * 1000
  if (template.trigger_type === "schedule_before") {
    return new Date(startMs - offsetMs).toISOString()
  }
  if (template.trigger_type === "schedule_after") {
    return new Date(startMs + offsetMs).toISOString()
  }
  return null
}

function isTransactionalDbLog(row: NotificationLogRow): boolean {
  const type = canonicalNotificationType(String(row.type ?? "").trim())
  return TRANSACTIONAL_HISTORY_TYPES.has(type)
}

function typeLabel(
  canonicalType: string,
  t: (key: string) => string,
  customTemplateNames: Record<string, string>,
  timingMinutesBefore?: number | null,
): string {
  if (isCustomTemplateFilterKey(canonicalType)) {
    const name = customTemplateNames[customTemplateIdFromFilterKey(canonicalType)]?.trim()
    return name || "Własny szablon"
  }
  if (canonicalType === "reminder_24h") {
    return reminderHistoryTypeLabel("first", timingMinutesBefore, t("notifications.reminder24hType"))
  }
  if (canonicalType === "reminder_before_visit") {
    return reminderHistoryTypeLabel("second", timingMinutesBefore, t("notifications.secondReminderType"))
  }
  if (canonicalType === "booking_confirmation") return t("notifications.bookingConfirmationType")
  if (canonicalType === "booking_cancelled_by_company") return "Anulowanie wizyty"
  if (canonicalType === "no_show_follow_up") return "Follow-up po nieobecności"
  if (canonicalType === "integration_test") return t("messagesLog.integrationTestLine")
  return canonicalType
}

function buildLogDedupKeys(rows: NotificationLogRow[]): Set<string> {
  const keys = new Set<string>()
  for (const row of rows) {
    if (!row.booking_id) continue
    const type = canonicalNotificationType(String(row.type ?? "").trim())
    keys.add(`${row.booking_id}:${type}:${dbChannel(row)}`)
  }
  return keys
}

function normalizeOutcomeStatus(raw: string | null | undefined, hasSentAt: boolean): string {
  const s = String(raw ?? "").trim().toLowerCase()
  if (s === "sent") return "sent"
  if (s === "skipped") return "skipped"
  if (s === "failed") return "failed"
  if (s === "not_configured") return "not_configured"
  if (s === "simulated_dev" || s === "simulated") return "simulated_dev"
  if (hasSentAt) return "sent"
  return s || "pending"
}

function mergeBookingReminderRows(
  active: PlannedReminderRow[],
  history: PlannedReminderRow[],
): PlannedReminderRow[] {
  const byId = new Map<string, PlannedReminderRow>()
  for (const row of [...active, ...history]) {
    byId.set(row.id, row)
  }
  return Array.from(byId.values())
}

function entryChannel(entry: MergedEntry): "sms" | "email" {
  if (entry.kind === "db") return dbChannel(entry.row)
  if (
    entry.kind === "planned" ||
    entry.kind === "reminderOutcome" ||
    entry.kind === "customSend" ||
    entry.kind === "plannedCustom"
  ) {
    return entry.channel
  }
  return entry.msg.channel
}

function resolvedHistoryTypeFilter(entry: MergedEntry): string {
  if (entry.kind === "customSend" || entry.kind === "plannedCustom") {
    const templateId =
      entry.kind === "customSend" ? entry.row.custom_template_id : entry.templateId
    return customTemplateFilterKey(templateId)
  }
  if (entry.kind === "db") {
    return canonicalNotificationType(String(entry.row.type ?? "").trim())
  }
  if (entry.kind === "planned" || entry.kind === "reminderOutcome") {
    return entry.reminderType
  }
  return canonicalNotificationType(String(entry.msg.type ?? "").trim())
}

function mergeEntries(
  rows: NotificationLogRow[],
  local: NotificationMessage[],
  planned: PlannedReminderRow[],
  queueByKey: Map<string, AppointmentReminderQueueRow>,
  customSends: CustomTemplateSendRow[],
  customTemplates: CustomTemplateRow[],
  nowMs: number,
): MergedEntry[] {
  const out: MergedEntry[] = []
  const logKeys = buildLogDedupKeys(rows)
  for (const row of rows) {
    out.push({ kind: "db", sortAt: row.sent_at ?? row.created_at, row })
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
      firstStatus !== "sent" &&
      (firstStatus === "" || firstStatus === "pending" || firstStatus === "queued" || firstStatus === "scheduled")
    const secondPending =
      row.second_reminder_sent_at == null &&
      secondStatus !== "sent" &&
      (secondStatus === "" || secondStatus === "pending" || secondStatus === "queued" || secondStatus === "scheduled")
    if (firstPending) {
      if (row.client_phone?.trim()) {
        const key = `${row.id}:reminder_24h:sms`
        if (!logKeys.has(key) && !isQueueChannelSettled(queueByKey.get(queueLookupKey(row.id, "reminder_24h", "sms")))) {
          out.push({
            kind: "planned",
            sortAt: queueByKey.get(queueLookupKey(row.id, "reminder_24h", "sms"))?.scheduled_for ?? firstDue,
            row,
            channel: "sms",
            reminderType: "reminder_24h",
          })
        }
      }
      if (row.client_email?.trim()) {
        const key = `${row.id}:reminder_24h:email`
        if (!logKeys.has(key) && !isQueueChannelSettled(queueByKey.get(queueLookupKey(row.id, "reminder_24h", "email")))) {
          out.push({
            kind: "planned",
            sortAt: queueByKey.get(queueLookupKey(row.id, "reminder_24h", "email"))?.scheduled_for ?? firstDue,
            row,
            channel: "email",
            reminderType: "reminder_24h",
          })
        }
      }
    }
    if (secondPending) {
      if (row.client_phone?.trim()) {
        const key = `${row.id}:reminder_before_visit:sms`
        if (!logKeys.has(key) && !isQueueChannelSettled(queueByKey.get(queueLookupKey(row.id, "reminder_before_visit", "sms")))) {
          out.push({
            kind: "planned",
            sortAt: queueByKey.get(queueLookupKey(row.id, "reminder_before_visit", "sms"))?.scheduled_for ?? secondDue,
            row,
            channel: "sms",
            reminderType: "reminder_before_visit",
          })
        }
      }
      if (row.client_email?.trim()) {
        const key = `${row.id}:reminder_before_visit:email`
        if (!logKeys.has(key) && !isQueueChannelSettled(queueByKey.get(queueLookupKey(row.id, "reminder_before_visit", "email")))) {
          out.push({
            kind: "planned",
            sortAt: queueByKey.get(queueLookupKey(row.id, "reminder_before_visit", "email"))?.scheduled_for ?? secondDue,
            row,
            channel: "email",
            reminderType: "reminder_before_visit",
          })
        }
      }
    }
    if (!firstPending) {
      const sortAt = row.first_reminder_sent_at?.trim() || firstDue
      const outcomeStatus = normalizeOutcomeStatus(row.first_reminder_status, Boolean(row.first_reminder_sent_at))
      if (row.client_email?.trim()) {
        const key = `${row.id}:reminder_24h:email`
        if (!logKeys.has(key)) {
          out.push({
            kind: "reminderOutcome",
            sortAt,
            row,
            channel: "email",
            reminderType: "reminder_24h",
            outcomeStatus,
          })
        }
      }
      if (row.client_phone?.trim()) {
        const key = `${row.id}:reminder_24h:sms`
        if (!logKeys.has(key)) {
          out.push({
            kind: "reminderOutcome",
            sortAt,
            row,
            channel: "sms",
            reminderType: "reminder_24h",
            outcomeStatus,
          })
        }
      }
    }
    if (!secondPending) {
      const sortAt = row.second_reminder_sent_at?.trim() || secondDue
      const outcomeStatus = normalizeOutcomeStatus(row.second_reminder_status, Boolean(row.second_reminder_sent_at))
      if (row.client_email?.trim()) {
        const key = `${row.id}:reminder_before_visit:email`
        if (!logKeys.has(key)) {
          out.push({
            kind: "reminderOutcome",
            sortAt,
            row,
            channel: "email",
            reminderType: "reminder_before_visit",
            outcomeStatus,
          })
        }
      }
      if (row.client_phone?.trim()) {
        const key = `${row.id}:reminder_before_visit:sms`
        if (!logKeys.has(key)) {
          out.push({
            kind: "reminderOutcome",
            sortAt,
            row,
            channel: "sms",
            reminderType: "reminder_before_visit",
            outcomeStatus,
          })
        }
      }
    }
  }
  for (const msg of local) {
    out.push({ kind: "local", sortAt: msg.createdAt, msg })
  }

  const templateById = customTemplateById(customTemplates)
  const settledCustomKeys = buildSettledCustomSendKeys(customSends)
  for (const template of customTemplates) {
    if (!isScheduledCustomTrigger(template.trigger_type)) continue
    for (const row of planned) {
      const triggerIso = computeCustomTemplateTriggerIso(row, template)
      if (!triggerIso) continue
      if (new Date(triggerIso).getTime() <= nowMs) continue
      if (template.sms_enabled && row.client_phone?.trim()) {
        const key = customSendDedupKey(row.id, template.id, "sms")
        if (!settledCustomKeys.has(key)) {
          out.push({
            kind: "plannedCustom",
            sortAt: triggerIso,
            row,
            channel: "sms",
            templateId: template.id,
          })
        }
      }
      if (template.email_enabled && row.client_email?.trim()) {
        const key = customSendDedupKey(row.id, template.id, "email")
        if (!settledCustomKeys.has(key)) {
          out.push({
            kind: "plannedCustom",
            sortAt: triggerIso,
            row,
            channel: "email",
            templateId: template.id,
          })
        }
      }
    }
  }

  for (const row of customSends) {
    if (!shouldIncludeCustomSendRow(row, templateById)) continue
    const channel = customSendChannel(row)
    out.push({
      kind: "customSend",
      sortAt: customSendSortAt(row),
      row,
      channel,
    })
  }
  out.sort(
    (a, b) =>
      new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
  )
  return out
}

function canonicalStatus(
  entry: MergedEntry,
  customTemplateByIdMap?: Map<string, CustomTemplateRow>,
): string {
  if (entry.kind === "planned" || entry.kind === "plannedCustom") return "scheduled"
  if (entry.kind === "reminderOutcome") return entry.outcomeStatus
  if (entry.kind === "customSend") {
    const st = String(entry.row.status ?? "").trim().toLowerCase()
    if (st === "sent") return "sent"
    if (st === "failed") return "failed"
    if (st === "skipped") return "skipped"
    const trigger =
      customTemplateByIdMap?.get(entry.row.custom_template_id)?.trigger_type ?? ""
    if (isScheduledCustomTrigger(trigger) && (st === "pending" || st === "processing")) {
      return "scheduled"
    }
    if (st === "processing") return "pending"
    return st || "pending"
  }
  if (entry.kind === "db") {
    const st = entry.row.status.trim().toLowerCase()
    if (st === "sent") return "sent"
    if (
      entry.row.sent_at?.trim() &&
      st !== "failed" &&
      st !== "not_configured" &&
      (st !== "skipped" || isTransactionalDbLog(entry.row))
    ) {
      return "sent"
    }
    if (st === "queued" && isTransactionalDbLog(entry.row) && entry.row.sent_at?.trim()) {
      return "sent"
    }
    return st
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

function entryMatchesFilter(
  entry: MergedEntry,
  filter: HistoryFilter,
  customTemplateByIdMap: Map<string, CustomTemplateRow>,
): boolean {
  if (filter === "all") return true
  const c = canonicalStatus(entry, customTemplateByIdMap)
  if (filter === "sent") return c === "sent"
  if (filter === "scheduled") {
    return (
      (entry.kind === "planned" || entry.kind === "plannedCustom") && c === "scheduled"
    ) || (entry.kind === "customSend" && c === "scheduled")
  }
  if (filter === "skipped") {
    return c === "skipped" || c === "not_configured" || c === "failed"
  }
  return true
}

function listTypeLine(
  entry: MergedEntry,
  t: (key: string) => string,
  customTemplateNames: Record<string, string>,
): string {
  const channel =
    entry.kind === "db"
      ? dbChannel(entry.row)
      : entry.kind === "planned" ||
          entry.kind === "reminderOutcome" ||
          entry.kind === "customSend" ||
          entry.kind === "plannedCustom"
        ? entry.channel
        : entry.msg.channel

  if (entry.kind === "customSend" || entry.kind === "plannedCustom") {
    const templateId =
      entry.kind === "customSend" ? entry.row.custom_template_id : entry.templateId
    const name = customTemplateNames[templateId]?.trim() || "Własny szablon"
    const chLabel = channel === "email" ? t("messages.email") : t("messages.sms")
    return `${name} - ${chLabel}`
  }

  const rawType =
    entry.kind === "db"
      ? String(entry.row.type ?? "").trim()
      : entry.kind === "planned" || entry.kind === "reminderOutcome"
        ? entry.reminderType
        : entry.msg.type
  const type = canonicalNotificationType(rawType)

  if (rawType === "manual_reminder") {
    return channel === "email"
      ? t("messagesLog.reminderEmailLine")
      : t("messagesLog.reminderSmsLine")
  }

  const chLabel = channel === "email" ? t("messages.email") : t("messages.sms")
  const timingMinutesBefore = entry.kind === "db" ? entry.row.timing_minutes_before : null
  if (type) return `${typeLabel(type, t, customTemplateNames, timingMinutesBefore)} - ${chLabel}`
  return chLabel
}

function previewAsMerged(p: PreviewTarget): MergedEntry {
  if (p.kind === "db") {
    return { kind: "db", sortAt: p.row.sent_at ?? p.row.created_at, row: p.row }
  }
  if (p.kind === "planned") {
    return { kind: "planned", sortAt: p.row.first_reminder_due_at ?? p.row.appointment_date, row: p.row, channel: p.channel, reminderType: p.reminderType }
  }
  if (p.kind === "reminderOutcome") {
    const sortAt =
      p.reminderType === "reminder_24h"
        ? p.row.first_reminder_sent_at ?? p.row.first_reminder_due_at ?? p.row.appointment_date
        : p.row.second_reminder_sent_at ?? p.row.second_reminder_due_at ?? p.row.appointment_date
    return {
      kind: "reminderOutcome",
      sortAt,
      row: p.row,
      channel: p.channel,
      reminderType: p.reminderType,
      outcomeStatus: p.outcomeStatus,
    }
  }
  if (p.kind === "customSend") {
    return {
      kind: "customSend",
      sortAt: customSendSortAt(p.row),
      row: p.row,
      channel: p.channel,
    }
  }
  if (p.kind === "plannedCustom") {
    return {
      kind: "plannedCustom",
      sortAt: p.row.appointment_date,
      row: p.row,
      channel: p.channel,
      templateId: p.templateId,
    }
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
  t: (key: string) => string,
  entry?: MergedEntry,
): string {
  switch (canon) {
    case "sent":
      return t("messagesLog.statusSent")
    case "scheduled":
      return t("messagesLog.statusScheduled")
    case "queued":
      if (entry?.kind === "db" && isTransactionalDbLog(entry.row)) {
        return t("messagesLog.statusPending")
      }
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
  if (entry.kind === "planned" || entry.kind === "reminderOutcome" || entry.kind === "plannedCustom") {
    const v = entry.channel === "email" ? entry.row.client_email : entry.row.client_phone
    return v?.trim() || "-"
  }
  if (entry.kind === "customSend") {
    return entry.row.recipient?.trim() || "-"
  }
  return entry.row.recipient?.trim() || "-"
}

function bodyForPreview(entry: PreviewTarget): string | null {
  if (entry.kind === "planned" || entry.kind === "reminderOutcome" || entry.kind === "plannedCustom") {
    return null
  }
  if (entry.kind === "customSend") {
    return entry.row.body?.trim() || null
  }
  if (entry.kind === "db") {
    const b = entry.row.body?.trim()
    return b || null
  }
  const b = entry.msg.body?.trim()
  return b || null
}

function subjectForPreview(entry: PreviewTarget): string | null {
  if (entry.kind === "planned" || entry.kind === "reminderOutcome" || entry.kind === "plannedCustom") {
    return null
  }
  if (entry.kind === "customSend") {
    return entry.row.subject?.trim() || null
  }
  if (entry.kind === "db") {
    const s = entry.row.subject?.trim()
    return s || null
  }
  const s = entry.msg.subject?.trim()
  return s || null
}

function plannedAtIso(
  entry: {
    row: PlannedReminderRow
    reminderType: "reminder_24h" | "reminder_before_visit"
    channel?: "sms" | "email"
  },
  queueByKey?: Map<string, AppointmentReminderQueueRow>,
): string {
  if (entry.channel && queueByKey) {
    const scheduled = queueByKey.get(queueLookupKey(entry.row.id, entry.reminderType, entry.channel))
      ?.scheduled_for
    if (scheduled?.trim()) return scheduled
  }
  const startIso = `${entry.row.appointment_date}T${String(entry.row.appointment_time).slice(0, 5)}:00`
  const startMs = new Date(startIso).getTime()
  if (entry.reminderType === "reminder_24h") {
    if (entry.row.first_reminder_due_at?.trim()) return entry.row.first_reminder_due_at
    return Number.isNaN(startMs) ? startIso : new Date(startMs - 24 * 60 * 60 * 1000).toISOString()
  }
  if (entry.row.second_reminder_due_at?.trim()) return entry.row.second_reminder_due_at
  return Number.isNaN(startMs) ? startIso : new Date(startMs - 60 * 60 * 1000).toISOString()
}

function entryErrorDetail(
  entry: MergedEntry,
  t: (key: string) => string,
  language: "pl" | "en",
): string | null {
  if (entry.kind === "planned" || entry.kind === "reminderOutcome" || entry.kind === "plannedCustom") {
    return null
  }
  if (entry.kind === "customSend") {
    const st = String(entry.row.status ?? "").trim().toLowerCase()
    if (st === "failed" || st === "skipped") {
      const raw = entry.row.last_error?.trim()
      return raw ? formatDeliveryError(raw, t, language) : null
    }
    return null
  }
  if (entry.kind === "db") {
    const st = entry.row.status.trim().toLowerCase()
    if (st === "failed" || st === "skipped" || st === "not_configured") {
      const raw = entry.row.error_message?.trim()
      return raw ? formatDeliveryError(raw, t, language) : null
    }
    return null
  }
  if (entry.msg.status === "failed") {
    return localFailureDetail(entry.msg, t)
  }
  return null
}

function errorForPreview(
  entry: PreviewTarget,
  t: (k: string) => string,
  language: "pl" | "en",
): string | null {
  if (entry.kind === "planned" || entry.kind === "reminderOutcome") return null
  if (entry.kind === "customSend") {
    const st = String(entry.row.status ?? "").trim().toLowerCase()
    if (st === "failed" || st === "skipped") {
      const raw = entry.row.last_error?.trim()
      return raw ? formatDeliveryError(raw, t, language) : null
    }
    return null
  }
  if (entry.kind === "db") {
    const st = entry.row.status.trim().toLowerCase()
    if (
      st === "failed" ||
      st === "skipped" ||
      st === "not_configured"
    ) {
      const raw = entry.row.error_message?.trim()
      return raw ? formatDeliveryError(raw, t, language) : null
    }
    return null
  }
  if (entry.kind === "local" && entry.msg.status === "failed") {
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
  const [appointmentReminderQueue, setAppointmentReminderQueue] = React.useState<
    AppointmentReminderQueueRow[]
  >([])
  const [templateTypes, setTemplateTypes] = React.useState<string[]>([])
  const [customTemplates, setCustomTemplates] = React.useState<CustomTemplateRow[]>([])
  const [customSendRows, setCustomSendRows] = React.useState<CustomTemplateSendRow[]>([])
  const [localMessages, setLocalMessages] = React.useState<NotificationMessage[]>([])
  const [businessSlugNorm, setBusinessSlugNorm] = React.useState<string | null>(null)
  const [filter, setFilter] = React.useState<HistoryFilter>("all")
  const [channelFilter, setChannelFilter] = React.useState<ChannelFilter>("all")
  const [dateRange, setDateRange] = React.useState<DateRangeFilter>("30d")
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all")
  const [preview, setPreview] = React.useState<PreviewTarget | null>(null)
  const [previewBookingInfo, setPreviewBookingInfo] = React.useState<PreviewBookingInfo | null>(null)
  const [previewBusinessInfo, setPreviewBusinessInfo] = React.useState<PreviewBusinessInfo | null>(null)
  const [previewDetails, setPreviewDetails] = React.useState<NotificationPreviewDetails | null>(null)
  const [previewDetailsLoading, setPreviewDetailsLoading] = React.useState(false)
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
    function refreshDb() {
      historyLoadedRef.current = false
      setLogRefreshTick((n) => n + 1)
    }
    refresh()
    window.addEventListener("pw-notification-messages", refresh)
    window.addEventListener("pw-bookings", refreshDb)
    window.addEventListener("pw-custom-templates", refreshDb)
    return () => {
      window.removeEventListener("pw-notification-messages", refresh)
      window.removeEventListener("pw-bookings", refreshDb)
      window.removeEventListener("pw-custom-templates", refreshDb)
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

      const [logsLoad, { data: templateRows }, { data: customTemplateRows }, customSendsLoad, queueLogRows, appointmentQueueRows] =
        await Promise.all([
        loadNotificationLogRows(client, bid),
        client.from("message_templates").select("type").eq("business_id", bid),
        client
          .from("custom_templates")
          .select("id,name,trigger_type,offset_minutes,sms_enabled,email_enabled")
          .eq("business_id", bid),
        client
          .from("custom_template_sends")
          .select("*")
          .eq("business_id", bid)
          .order("created_at", { ascending: false })
          .limit(500),
        loadSentAppointmentReminderLogRows(client, bid),
        loadAppointmentReminderQueueRows(client, bid),
      ])
      const logRows = mergeLogRowsWithQueueHistory(logsLoad.rows, queueLogRows)
      const qErr = logsLoad.error

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
          plannedRowsResolved = ((legacyPlanData ?? []) as LegacyPlannedReminderRow[]).map(mapLegacyPlannedReminderRow)
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

      if (!plannedError) {
        const historyRows = await loadSentReminderHistoryRows(client, bid)
        if (historyRows.length > 0) {
          plannedRowsResolved = mergeBookingReminderRows(plannedRowsResolved, historyRows)
        }
      }

      if (cancelled) return
      if (qErr && logRows.length === 0) {
        setLoadError(qErr)
        setRows([])
      } else {
        setLoadError(qErr && logRows.length > 0 ? qErr : null)
        setRows(logRows)
        if (!plannedError) {
          setPlannedRows(plannedRowsResolved)
        } else {
          setPlannedRows([])
        }
        setAppointmentReminderQueue(appointmentQueueRows)
        const nextTemplateTypes = Array.from(
          new Set(
            (templateRows ?? [])
              .map((row) => canonicalNotificationType(String((row as { type?: string }).type ?? "").trim()))
              .filter(Boolean),
          ),
        )
        setTemplateTypes(nextTemplateTypes)
        setCustomTemplates((customTemplateRows ?? []) as CustomTemplateRow[])
        if (!customSendsLoad.error) {
          setCustomSendRows((customSendsLoad.data ?? []) as CustomTemplateSendRow[])
        } else {
          setCustomSendRows([])
        }
        if (process.env.NODE_ENV === "development") {
          console.info("[notifications.logs.load]", {
            businessId: bid,
            count: logRows.length,
            plannedCount: plannedRowsResolved.length,
            error: qErr,
            plannedError: plannedError?.message ?? null,
          })
        }
      }
      if (process.env.NODE_ENV === "development" && qErr && logRows.length === 0) {
        console.info("[notifications.logs.load]", {
          businessId: bid,
          count: 0,
          error: qErr,
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

  const queueByKey = React.useMemo(
    () => buildQueueStatusMap(appointmentReminderQueue),
    [appointmentReminderQueue],
  )

  const customTemplateNames = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const row of customTemplates) {
      if (row.id) map[row.id] = row.name?.trim() || "Własny szablon"
    }
    return map
  }, [customTemplates])

  const customTemplateByIdMap = React.useMemo(
    () => customTemplateById(customTemplates),
    [customTemplates],
  )

  const [nowMs] = React.useState<number>(() => new Date().getTime())

  const merged = React.useMemo(
    () =>
      mergeEntries(
        rows,
        scopedLocal,
        plannedRows,
        queueByKey,
        customSendRows,
        customTemplates,
        nowMs,
      ),
    [rows, scopedLocal, plannedRows, queueByKey, customSendRows, customTemplates, nowMs],
  )

  const availableTypeFilters = React.useMemo(() => {
    const fromEntries = merged.map((entry) => resolvedHistoryTypeFilter(entry)).filter(Boolean)
    const customKeys = customTemplates.map((row) => customTemplateFilterKey(row.id))
    const combined = new Set<string>([
      ...STANDARD_MESSAGE_TEMPLATE_TYPES,
      ...customKeys,
      ...templateTypes,
      ...fromEntries,
    ])
    const customSorted = [...customKeys]
      .filter((key) => combined.has(key))
      .sort((a, b) =>
        (customTemplateNames[customTemplateIdFromFilterKey(a)] ?? "").localeCompare(
          customTemplateNames[customTemplateIdFromFilterKey(b)] ?? "",
          language === "en" ? "en" : "pl",
        ),
      )
    const standard = STANDARD_MESSAGE_TEMPLATE_TYPES.filter((type) => combined.has(type))
    const orphan = [...combined].filter(
      (type) =>
        !STANDARD_MESSAGE_TEMPLATE_TYPES.includes(type as (typeof STANDARD_MESSAGE_TEMPLATE_TYPES)[number]) &&
        !customKeys.includes(type),
    )
    return [...standard, ...customSorted, ...orphan]
  }, [merged, templateTypes, customTemplates, customTemplateNames, language])

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
      .filter((e) => entryMatchesFilter(e, filter, customTemplateByIdMap))
      .filter((e) => {
        if (channelFilter === "all") return true
        return entryChannel(e) === channelFilter
      })
      .filter((e) => {
        if (sinceMs == null) return true
        return new Date(e.sortAt).getTime() >= sinceMs
      })
      .filter((e) => {
        if (typeFilter === "all") return true
        return resolvedHistoryTypeFilter(e) === typeFilter
      })
  }, [merged, filter, channelFilter, dateRange, typeFilter, nowMs, customTemplateByIdMap])

  React.useEffect(() => {
    if (typeFilter === "all") return
    if (!availableTypeFilters.includes(typeFilter)) {
      setTypeFilter("all")
    }
  }, [typeFilter, availableTypeFilters])

  const listEntries = React.useMemo(() => {
    if (logFilter === "failed") {
      return tabFiltered.filter((e) => canonicalStatus(e, customTemplateByIdMap) === "failed")
    }
    if (logFilter !== "needs_attention") return tabFiltered
    return tabFiltered.filter((e) => {
      const c = canonicalStatus(e, customTemplateByIdMap)
      return c === "failed" || c === "scheduled" || c === "queued" || c === "pending"
    })
  }, [tabFiltered, logFilter, customTemplateByIdMap])

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(language === "en" ? "en-US" : "pl-PL", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [language]
  )

  const bookingIdForPreview =
    preview?.kind === "customSend"
      ? preview.row.appointment_id
      : preview?.kind === "db"
      ? preview.row.booking_id
      : preview?.kind === "planned" ||
          preview?.kind === "reminderOutcome" ||
          preview?.kind === "plannedCustom"
        ? preview.row.id
      : preview?.kind === "local"
        ? preview.msg.bookingId
        : null

  React.useEffect(() => {
    if (!preview) {
      setPreviewBookingInfo(null)
      setPreviewBusinessInfo(null)
      setPreviewDetails(null)
      setPreviewDetailsLoading(false)
      return
    }
    if (!isSupabaseConfigured()) {
      return
    }
    const client = getBrowserClient()
    const bid = access.businessId
    if (!client || !bid) {
      return
    }
    let cancelled = false
    setPreviewDetailsLoading(true)
    void (async () => {
      let bookingInfo: PreviewBookingInfo | null = null
      let businessInfo: PreviewBusinessInfo | null = null

      const { data: businessData } = await client
        .from("business_profiles")
        .select("business_name,slug,phone,contact_phone,business_address")
        .eq("id", bid)
        .maybeSingle()

      if (businessData) {
        businessInfo = {
          business_name:
            typeof businessData.business_name === "string" ? businessData.business_name : null,
          slug: typeof businessData.slug === "string" ? businessData.slug : null,
          phone: typeof businessData.phone === "string" ? businessData.phone : null,
          contact_phone:
            typeof businessData.contact_phone === "string" ? businessData.contact_phone : null,
          business_address:
            typeof businessData.business_address === "string"
              ? businessData.business_address
              : null,
        }
      }

      if (bookingIdForPreview) {
        bookingInfo = await loadPreviewBookingInfo(client, bookingIdForPreview)
      }

      if (cancelled) return

      setPreviewBookingInfo(bookingInfo)
      setPreviewBusinessInfo(businessInfo)

      const details = await loadNotificationPreviewDetails({
        client,
        businessId: bid,
        target: preview as NotificationPreviewTarget,
        booking: bookingInfo,
        business: businessInfo,
        queueByKey,
        language: language === "en" ? "en" : "pl",
        formatDateTime: (raw) => safeFormatDate(raw, dateFmt),
        scheduledSendLabel: (dateTime) =>
          t("messagesLog.scheduledSendAt").replace("{dateTime}", dateTime),
      })

      if (!cancelled) {
        setPreviewDetails(details)
        setPreviewDetailsLoading(false)
      }
    })().catch(() => {
      if (!cancelled) {
        setPreviewDetails(null)
        setPreviewDetailsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [preview, bookingIdForPreview, access.businessId, queueByKey, dateFmt, language, t])

  const relatedAppointmentInfo = React.useMemo((): PreviewBookingInfo | null => {
    if (previewBookingInfo) return previewBookingInfo
    if (preview?.kind === "planned" || preview?.kind === "reminderOutcome") {
      return {
        id: preview.row.id,
        clientName: preview.row.client_name?.trim() || "",
        serviceName: "",
        appointmentDate: String(preview.row.appointment_date ?? "").slice(0, 10),
        appointmentTime: String(preview.row.appointment_time ?? "").slice(0, 5),
        status: "",
        createdAt: null,
        confirmedAt: null,
        updatedAt: null,
        lastStatusChangeSource: null,
        confirmationToken: null,
        staffName: null,
      }
    }
    return null
  }, [previewBookingInfo, preview])

  const relatedStatusLabel = React.useMemo(() => {
    const raw = (relatedAppointmentInfo?.status ?? "").toLowerCase()
    if (!raw) return "-"
    if (raw === "booked") return "Zarezerwowana"
    if (raw === "pending") return "Do potwierdzenia"
    if (raw === "confirmed") return "Potwierdzona"
    if (raw === "cancelled") return "Anulowana"
    if (raw === "completed") return "Zrealizowana"
    if (raw === "no_show") return "Nieobecność"
    return raw
  }, [relatedAppointmentInfo?.status])

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
          {filter === "skipped" ? (
            <p className="text-xs leading-relaxed text-muted-foreground" role="status">
              {t("messagesLog.filterHintSkipped")}
            </p>
          ) : null}
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
                  {typeLabel(type, t, customTemplateNames)}
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
                      : entry.kind === "reminderOutcome"
                        ? `outcome:${entry.row.id}:${entry.reminderType}:${entry.channel}`
                        : entry.kind === "customSend"
                          ? `custom:${entry.row.id}:${entry.channel}`
                          : entry.kind === "plannedCustom"
                            ? `plannedCustom:${entry.row.id}:${entry.templateId}:${entry.channel}`
                            : `local:${entry.msg.id}`
                const canon = canonicalStatus(entry, customTemplateByIdMap)
                const errorDetail = entryErrorDetail(entry, t, language)
                return (
                  <li key={key} className="min-h-[4.5rem] px-3 py-3 sm:px-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {listTypeLine(entry, t, customTemplateNames)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              semanticStatusBadgeClass(statusTone(canon))
                            )}
                          >
                            {statusDisplay(canon, t, entry)}
                          </span>
                          <span className="tabular-nums">
                            {safeFormatDate(entry.sortAt, dateFmt)}
                          </span>
                          {errorDetail ? (
                            <span className="text-amber-800 dark:text-amber-200/95">
                              {errorDetail}
                            </span>
                          ) : null}
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
                                : entry.kind === "reminderOutcome"
                                  ? {
                                      kind: "reminderOutcome",
                                      row: entry.row,
                                      channel: entry.channel,
                                      reminderType: entry.reminderType,
                                      outcomeStatus: entry.outcomeStatus,
                                    }
                                  : entry.kind === "customSend"
                                    ? {
                                        kind: "customSend",
                                        row: entry.row,
                                        channel: entry.channel,
                                      }
                                    : entry.kind === "plannedCustom"
                                      ? {
                                          kind: "plannedCustom",
                                          row: entry.row,
                                          channel: entry.channel,
                                          templateId: entry.templateId,
                                        }
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
            setPreviewBusinessInfo(null)
            setPreviewDetails(null)
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
                  {listTypeLine(previewAsMerged(preview), t, customTemplateNames)}
                </SheetDescription>
              </SheetHeader>
              <div className="premium-scrollbar flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto px-6 py-6">
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldMessageType")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {listTypeLine(previewAsMerged(preview), t, customTemplateNames)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldChannel")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {(preview.kind === "db"
                        ? dbChannel(preview.row)
                        : preview.kind === "customSend" ||
                            preview.kind === "planned" ||
                            preview.kind === "reminderOutcome" ||
                            preview.kind === "plannedCustom"
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
                        : preview.kind === "planned" ||
                            preview.kind === "reminderOutcome" ||
                            preview.kind === "plannedCustom"
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
                      {statusDisplay(
                        canonicalStatus(previewAsMerged(preview), customTemplateByIdMap),
                        t,
                        previewAsMerged(preview),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldCreatedAt")}
                    </dt>
                    <dd className="mt-0.5 tabular-nums text-foreground">
                      {previewDetailsLoading
                        ? t("messagesLog.loading")
                        : safeFormatDate(previewDetails?.createdAtIso, dateFmt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("messagesLog.fieldSentAt")}
                    </dt>
                    <dd className="mt-0.5 text-foreground">
                      {previewDetailsLoading
                        ? t("messagesLog.loading")
                        : previewDetails?.sentAtLabel ?? "-"}
                    </dd>
                  </div>
                  {(preview.kind === "db" && dbChannel(preview.row) === "email") ||
                  (preview.kind === "local" && preview.msg.channel === "email") ||
                  (preview.kind === "planned" && preview.channel === "email") ||
                  (preview.kind === "reminderOutcome" && preview.channel === "email") ? (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground">
                        {t("messagesLog.fieldSubject")}
                      </dt>
                      <dd className="mt-0.5 text-foreground">
                        {previewDetailsLoading
                          ? t("messagesLog.loading")
                          : previewDetails?.subject ||
                            subjectForPreview(preview) ||
                            "-"}
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
                      {previewDetailsLoading ? (
                        <span className="text-muted-foreground">{t("messagesLog.loading")}</span>
                      ) : previewDetails?.body ? (
                        previewDetails.body
                      ) : bodyForPreview(preview) ? (
                        bodyForPreview(preview)
                      ) : (
                        <span className="text-muted-foreground">
                          {t("messagesLog.noSavedBody")}
                        </span>
                      )}
                    </dd>
                  </div>
                  {errorForPreview(preview, t, language) ? (
                    <div>
                      <dt className="text-xs font-medium text-destructive">
                        {t("messagesLog.fieldError")}
                      </dt>
                      <dd className="mt-0.5 whitespace-pre-wrap text-destructive">
                        {errorForPreview(preview, t, language)}
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
                          {relatedAppointmentInfo?.appointmentDate || "-"}
                          {relatedAppointmentInfo?.appointmentTime
                            ? ` ${relatedAppointmentInfo.appointmentTime}`
                            : ""}
                          {" · "}
                          {relatedAppointmentInfo?.serviceName || "-"}
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
