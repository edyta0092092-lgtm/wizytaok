import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, TablesUpdate } from "@/types/database"

type Admin = SupabaseClient<Database>

const cancelStatusPatch = (nowIso: string): TablesUpdate<"bookings"> => ({
  cancelled_by: "client",
  cancelled_at: nowIso,
  status: "cancelled",
  last_updated_by: "customer",
  updated_at: nowIso,
})

/** Anulowanie service role — bez RPC (produkcyjny RPC cancel ustawia błędnie confirm). */
export async function cancelPublicBookingById(
  admin: Admin,
  bookingId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = bookingId.trim()
  if (!id) return { ok: false, error: "booking_id_required" }

  const nowIso = new Date().toISOString()
  const withSource: TablesUpdate<"bookings"> = {
    ...cancelStatusPatch(nowIso),
    last_status_change_source: "cancel",
  }

  const { error: fullErr } = await admin.from("bookings").update(withSource).eq("id", id)
  if (!fullErr) return { ok: true }

  const { error: statusErr } = await admin.from("bookings").update(cancelStatusPatch(nowIso)).eq("id", id)
  if (statusErr) return { ok: false, error: statusErr.message }

  await admin
    .from("bookings")
    .update({ last_status_change_source: "cancel", updated_at: nowIso })
    .eq("id", id)
    .eq("status", "cancelled")

  const { data: row, error: readErr } = await admin
    .from("bookings")
    .select("status, last_status_change_source")
    .eq("id", id)
    .maybeSingle()

  if (readErr) return { ok: false, error: readErr.message }
  if (row?.status !== "cancelled") {
    return { ok: false, error: "status_not_cancelled" }
  }

  if (row.last_status_change_source !== "cancel") {
    await admin
      .from("bookings")
      .update({ last_status_change_source: "cancel", updated_at: nowIso })
      .eq("id", id)
  }

  return { ok: true }
}
