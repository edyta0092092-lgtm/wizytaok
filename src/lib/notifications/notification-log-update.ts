import type { SupabaseClient } from "@supabase/supabase-js"

import {
  insertNotificationLog,
  type NotificationLogInsertInput,
} from "@/lib/notifications/notification-log-insert"
import type { Database } from "@/types/database"

type AdminClient = SupabaseClient<Database>

export type NotificationLogUpdatePatch = {
  status: string
  subject?: string | null
  body?: string | null
  provider?: string | null
  provider_message_id?: string | null
  error_message?: string | null
  error?: string | null
  sent_at?: string | null
  recipient?: string | null
  timing_minutes_before?: number | null
}

function isMissingErrorMessageColumn(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("error_message") && (m.includes("does not exist") || m.includes("schema cache"))
}

function isInvalidQueuedStatus(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("notification_logs_status_chk") || (m.includes("check constraint") && m.includes("status"))
}

function errorFieldValue(patch: NotificationLogUpdatePatch): string | null {
  return patch.error_message ?? patch.error ?? null
}

async function updateNotificationLogRow(
  admin: AdminClient,
  filters: { booking_id: string; type: string; channel: string },
  patch: NotificationLogUpdatePatch,
  logTag: string,
): Promise<{ ok: true; updated: boolean } | { ok: false; message: string }> {
  const base = {
    status: patch.status,
    subject: patch.subject ?? null,
    body: patch.body ?? null,
    provider: patch.provider ?? null,
    provider_message_id: patch.provider_message_id ?? null,
    sent_at: patch.sent_at ?? null,
    ...(patch.timing_minutes_before !== undefined
      ? { timing_minutes_before: patch.timing_minutes_before }
      : {}),
  }
  const errVal = errorFieldValue(patch)

  const modern = await admin
    .from("notification_logs")
    .update({ ...base, error_message: errVal })
    .eq("booking_id", filters.booking_id)
    .eq("type", filters.type)
    .eq("channel", filters.channel)
    .select("id")
    .maybeSingle()

  if (!modern.error && modern.data?.id) {
    return { ok: true, updated: true }
  }
  if (modern.error && !isMissingErrorMessageColumn(modern.error.message)) {
    console.error(logTag, { phase: "update", message: modern.error.message })
    return { ok: false, message: modern.error.message }
  }

  const legacy = await admin
    .from("notification_logs")
    .update({ ...base, error: errVal } as Database["public"]["Tables"]["notification_logs"]["Update"])
    .eq("booking_id", filters.booking_id)
    .eq("type", filters.type)
    .eq("channel", filters.channel)
    .select("id")
    .maybeSingle()

  if (legacy.error) {
    console.error(logTag, { phase: "update_legacy", message: legacy.error.message })
    return { ok: false, message: legacy.error.message }
  }
  return { ok: true, updated: Boolean(legacy.data?.id) }
}

/**
 * Aktualizuje wiersz logu; gdy brak wiersza (np. claim insert się nie udał), robi insert.
 */
export async function upsertNotificationLog(
  admin: AdminClient,
  filters: { booking_id: string; type: string; channel: string },
  insertBase: NotificationLogInsertInput,
  patch: NotificationLogUpdatePatch,
  logTag = "[notification.log]",
): Promise<void> {
  const updated = await updateNotificationLogRow(admin, filters, patch, logTag)
  if (updated.ok && updated.updated) return

  const recipient = (patch.recipient ?? insertBase.recipient ?? "").trim()
  let row: NotificationLogInsertInput = {
    ...insertBase,
    ...patch,
    recipient,
    error_message: errorFieldValue(patch),
  }

  let inserted = await insertNotificationLog(admin, row, logTag)
  if (inserted.ok) return

  if (row.status === "queued" && isInvalidQueuedStatus(inserted.message)) {
    row = { ...row, status: "pending" }
    inserted = await insertNotificationLog(admin, row, logTag)
    if (inserted.ok) return
  }

  console.error(logTag, {
    phase: "upsert_insert_failed",
    message: inserted.message,
    booking_id: filters.booking_id,
    type: filters.type,
    channel: filters.channel,
    status: row.status,
  })
}
