import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TablesUpdate } from "@/types/database"

type Admin = SupabaseClient<Database>

const LAST_STATUS_SOURCES = [
  "cancel",
  "confirm",
  "manual",
  "system",
  "auto_reminder_24h",
  "automatic_24h_reminder",
] as const

/** Anulowanie service role — kompatybilne ze starszym schematem bookings na produkcji. */
export async function cancelPublicBookingById(
  admin: Admin,
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = bookingId.trim()
  if (!id) return { ok: false, error: "booking_id_required" }

  const nowIso = new Date().toISOString()

  const { error: coreErr } = await admin
    .from("bookings")
    .update({
      status: "cancelled",
      last_updated_by: "customer",
      updated_at: nowIso,
    })
    .eq("id", id)

  if (coreErr) return { ok: false, error: coreErr.message }

  const optionalMeta: TablesUpdate<"bookings"> = {
    cancelled_at: nowIso,
    cancelled_by: "client",
  }
  await admin.from("bookings").update(optionalMeta).eq("id", id)

  for (const source of LAST_STATUS_SOURCES) {
    const { error: sourceErr } = await admin
      .from("bookings")
      .update({ last_status_change_source: source, updated_at: nowIso })
      .eq("id", id)
      .eq("status", "cancelled")
    if (!sourceErr) break
  }

  const { data: row, error: readErr } = await admin
    .from("bookings")
    .select("status")
    .eq("id", id)
    .maybeSingle()

  if (readErr) return { ok: false, error: readErr.message }
  if (row?.status !== "cancelled") {
    return { ok: false, error: "status_not_cancelled" }
  }

  return { ok: true }
}

export async function cancelPublicBookingByToken(
  admin: Admin,
  token: string,
): Promise<{ ok: true; bookingId: string } | { ok: false; error: string }> {
  const trimmed = token.trim()
  if (!trimmed) return { ok: false, error: "token_required" }

  const { data: bookingRaw, error: lookupErr } = await admin.rpc("get_booking_by_confirmation_token", {
    p_token: trimmed,
  })
  if (lookupErr) return { ok: false, error: lookupErr.message }
  if (!bookingRaw || typeof bookingRaw !== "object") {
    return { ok: false, error: "booking_not_found" }
  }
  const raw = bookingRaw as Record<string, unknown>
  const bookingId = String(raw.id ?? "").trim()
  if (!bookingId) return { ok: false, error: "booking_not_found" }

  const { data: rpcData, error: rpcErr } = await admin.rpc("update_booking_by_confirmation_token", {
    p_token: trimmed,
    p_action: "cancel",
    p_payload: {},
  })
  const rpcPayload = rpcData as { ok?: boolean; error?: string } | null
  if (!rpcErr && rpcPayload?.ok === true) {
    return { ok: true, bookingId }
  }

  const direct = await cancelPublicBookingById(admin, bookingId)
  if (!direct.ok) {
    const rpcHint = rpcPayload?.error ?? rpcErr?.message
    return { ok: false, error: rpcHint ? `${direct.error}; rpc: ${rpcHint}` : direct.error }
  }

  return { ok: true, bookingId }
}
