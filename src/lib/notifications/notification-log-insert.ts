import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TablesInsert } from "@/types/database"

type NotificationLogInsert = TablesInsert<"notification_logs">

/** Payload z opcjonalnym aliasem `error` (mapowany na `error_message` w DB). */
export type NotificationLogInsertInput = Omit<NotificationLogInsert, "error_message"> & {
  error_message?: string | null
  error?: string | null
}

export function toNotificationLogInsertRow(
  row: NotificationLogInsertInput,
): NotificationLogInsert {
  const { error, error_message, ...rest } = row
  return {
    ...rest,
    error_message: error_message ?? error ?? null,
  }
}

export async function insertNotificationLog(
  admin: SupabaseClient<Database>,
  row: NotificationLogInsertInput,
  logTag = "[notification.log]",
): Promise<{ ok: true; duplicate?: boolean } | { ok: false; message: string; code?: string }> {
  const payload = toNotificationLogInsertRow(row)
  const { error } = await admin.from("notification_logs").insert(payload)
  if (!error) {
    return { ok: true }
  }
  if (error.code === "23505") {
    if (
      payload.status === "sent" &&
      payload.booking_id &&
      payload.type &&
      payload.channel
    ) {
      await upgradeNotificationLogToSent(admin, payload)
    }
    return { ok: true, duplicate: true }
  }
  if (isMissingErrorMessageColumn(error.message)) {
    const { error_message, ...rest } = payload
    const legacyPayload = {
      ...rest,
      error: error_message ?? null,
    }
    const legacy = await admin
      .from("notification_logs")
      .insert(legacyPayload as NotificationLogInsert)
    if (!legacy.error) {
      return { ok: true }
    }
    if (legacy.error.code === "23505") {
      if (
        payload.status === "sent" &&
        payload.booking_id &&
        payload.type &&
        payload.channel
      ) {
        await upgradeNotificationLogToSent(admin, payload)
      }
      return { ok: true, duplicate: true }
    }
    console.error(logTag, {
      code: legacy.error.code,
      message: legacy.error.message,
      channel: row.channel,
      type: row.type,
      status: row.status,
      booking_id: row.booking_id,
    })
    return { ok: false, message: legacy.error.message, code: legacy.error.code ?? undefined }
  }
  console.error(logTag, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
    channel: row.channel,
    type: row.type,
    status: row.status,
    booking_id: row.booking_id,
  })
  return { ok: false, message: error.message, code: error.code ?? undefined }
}

function isMissingErrorMessageColumn(message: string): boolean {
  const m = message.toLowerCase()
  return m.includes("error_message") && (m.includes("does not exist") || m.includes("schema cache"))
}

async function upgradeNotificationLogToSent(
  admin: SupabaseClient<Database>,
  payload: NotificationLogInsert,
): Promise<void> {
  const sentAt = payload.sent_at ?? new Date().toISOString()
  const patch = {
    status: "sent" as const,
    sent_at: sentAt,
    recipient: payload.recipient ?? null,
    subject: payload.subject ?? null,
    body: payload.body ?? null,
    provider: payload.provider ?? null,
    provider_message_id: payload.provider_message_id ?? null,
    error_message: null,
  }
  const modern = await admin
    .from("notification_logs")
    .update(patch)
    .eq("booking_id", payload.booking_id!)
    .eq("type", payload.type!)
    .eq("channel", payload.channel)
    .select("id")
    .maybeSingle()
  if (!modern.error && modern.data?.id) return

  if (modern.error && isMissingErrorMessageColumn(modern.error.message)) {
    await admin
      .from("notification_logs")
      .update({ ...patch, error: null } as Database["public"]["Tables"]["notification_logs"]["Update"])
      .eq("booking_id", payload.booking_id!)
      .eq("type", payload.type!)
      .eq("channel", payload.channel)
  }
}

/** Zapisuje lub uaktualnia wpis „sent” (np. po duplikacie lub wcześniejszym skipped). */
export async function upsertSentNotificationLog(
  admin: SupabaseClient<Database>,
  row: NotificationLogInsertInput,
  logTag = "[notification.log]",
): Promise<{ ok: true; duplicate?: boolean } | { ok: false; message: string; code?: string }> {
  const payload = toNotificationLogInsertRow(row)
  if (payload.status !== "sent" || !payload.booking_id || !payload.type) {
    return insertNotificationLog(admin, row, logTag)
  }

  const { data: existing } = await admin
    .from("notification_logs")
    .select("id, status")
    .eq("booking_id", payload.booking_id)
    .eq("type", payload.type)
    .eq("channel", payload.channel)
    .maybeSingle()

  if (existing?.id) {
    await upgradeNotificationLogToSent(admin, payload)
    return { ok: true, duplicate: true }
  }

  return insertNotificationLog(admin, row, logTag)
}

async function verifySentNotificationLogRow(
  admin: SupabaseClient<Database>,
  bookingId: string,
  type: string,
  channel: string,
): Promise<boolean> {
  const { data } = await admin
    .from("notification_logs")
    .select("id, status, body, recipient")
    .eq("booking_id", bookingId)
    .eq("type", type)
    .eq("channel", channel)
    .maybeSingle()
  if (!data?.id) return false
  const st = String(data.status ?? "").trim().toLowerCase()
  const hasContent = Boolean(data.body?.trim()) || Boolean(data.recipient?.trim())
  return hasContent && (st === "sent" || st === "skipped" || st === "queued")
}

/**
 * Zapisuje wpis „sent” z upsertem po (booking_id, type, channel) — niezawodnie dla historii wysyłek.
 */
export async function forcePersistSentNotificationLog(
  admin: SupabaseClient<Database>,
  row: NotificationLogInsertInput,
  logTag = "[notification.log]",
): Promise<boolean> {
  const sentAt = row.sent_at ?? new Date().toISOString()
  const payload = toNotificationLogInsertRow({
    ...row,
    status: "sent",
    sent_at: sentAt,
  })
  if (!payload.booking_id || !payload.type) {
    return false
  }

  const { error: upsertErr } = await admin
    .from("notification_logs")
    .upsert(payload, { onConflict: "booking_id,type,channel" })

  if (!upsertErr) {
    const verified = await verifySentNotificationLogRow(
      admin,
      payload.booking_id,
      payload.type,
      payload.channel,
    )
    if (verified) return true
  } else {
    console.error(logTag, {
      phase: "upsert_failed",
      message: upsertErr.message,
      booking_id: payload.booking_id,
      type: payload.type,
      channel: payload.channel,
    })
  }

  const upgraded = await upsertSentNotificationLog(admin, row, logTag)
  if (!upgraded.ok) {
    return false
  }

  return verifySentNotificationLogRow(
    admin,
    payload.booking_id,
    payload.type,
    payload.channel,
  )
}
