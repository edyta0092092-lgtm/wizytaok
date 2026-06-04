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
      const sentAt = payload.sent_at ?? new Date().toISOString()
      await admin
        .from("notification_logs")
        .update({
          status: "sent",
          sent_at: sentAt,
          recipient: payload.recipient ?? null,
          subject: payload.subject ?? null,
          body: payload.body ?? null,
          provider: payload.provider ?? null,
          provider_message_id: payload.provider_message_id ?? null,
          error_message: null,
        })
        .eq("booking_id", payload.booking_id)
        .eq("type", payload.type)
        .eq("channel", payload.channel)
        .neq("status", "sent")
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
        const sentAt = payload.sent_at ?? new Date().toISOString()
        await admin
          .from("notification_logs")
          .update({
            status: "sent",
            sent_at: sentAt,
            recipient: payload.recipient ?? null,
            subject: payload.subject ?? null,
            body: payload.body ?? null,
            provider: payload.provider ?? null,
            provider_message_id: payload.provider_message_id ?? null,
            error_message: null,
          })
          .eq("booking_id", payload.booking_id)
          .eq("type", payload.type)
          .eq("channel", payload.channel)
          .neq("status", "sent")
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
