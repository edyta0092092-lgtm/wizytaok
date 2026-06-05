import type { SupabaseClient } from "@supabase/supabase-js"

import { isAppointmentTimeInAllowedSlots } from "@/lib/bookings/manual-booking-staff"
import { normalizeSlotTimeLabel } from "@/lib/bookings/slot-availability"
import type { Database, Tables, TablesUpdate } from "@/types/database"

type Admin = SupabaseClient<Database>

function toPgTimeHm(t: string): string {
  const parts = t.trim().split(":")
  const h = Math.min(23, Math.max(0, Number(parts[0] ?? 0)))
  const m = Math.min(59, Math.max(0, Number(parts[1] ?? 0)))
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`
}

const RESCHEDULABLE_STATUSES = new Set(["booked", "pending", "confirmed"])

export async function reschedulePublicBookingByToken(
  admin: Admin,
  token: string,
  newDate: string,
  newTime: string,
): Promise<
  | { ok: true; bookingId: string; booking: Tables<"bookings"> }
  | { ok: false; error: string }
> {
  const trimmed = token.trim()
  const dateStr = newDate.trim().slice(0, 10)
  const timeHm = normalizeSlotTimeLabel(newTime)
  if (!trimmed) return { ok: false, error: "token_required" }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: "invalid_date" }
  if (!timeHm) return { ok: false, error: "invalid_time" }

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

  const status = String(raw.status ?? "").trim().toLowerCase()
  if (!RESCHEDULABLE_STATUSES.has(status)) {
    return { ok: false, error: "booking_not_reschedulable" }
  }

  const currentDate = String(raw.appointment_date ?? "").slice(0, 10)
  const currentTime = normalizeSlotTimeLabel(String(raw.appointment_time ?? ""))
  if (currentDate === dateStr && currentTime === timeHm) {
    return { ok: false, error: "same_slot" }
  }

  const businessId = String(raw.business_id ?? "").trim()
  const serviceId = typeof raw.service_id === "string" ? raw.service_id.trim() : ""
  if (!businessId || !serviceId) {
    return { ok: false, error: "missing_service_context" }
  }

  const staffId =
    typeof raw.staff_id === "string" && raw.staff_id.trim().length > 0
      ? raw.staff_id.trim()
      : null

  const { data: serviceRow, error: serviceErr } = await admin
    .from("services")
    .select("id,duration_minutes,break_minutes,uses_default_availability")
    .eq("id", serviceId)
    .maybeSingle()
  if (serviceErr || !serviceRow) return { ok: false, error: "service_not_found" }

  const { data: businessRow } = await admin
    .from("business_profiles")
    .select("default_break_minutes")
    .eq("id", businessId)
    .maybeSingle()

  const slotOk = await isAppointmentTimeInAllowedSlots(
    admin,
    businessId,
    {
      id: serviceRow.id,
      durationMinutes: Math.max(1, Math.floor(Number(serviceRow.duration_minutes) || 60)),
      breakMinutes: Math.max(0, Math.floor(Number(serviceRow.break_minutes ?? 0) || 0)),
      usesDefaultAvailability: serviceRow.uses_default_availability !== false,
    },
    dateStr,
    timeHm,
    staffId,
    {
      defaultBreakMinutes: businessRow?.default_break_minutes ?? null,
      excludeBookingId: bookingId,
    },
  )
  if (!slotOk) return { ok: false, error: "slot_unavailable" }

  const nowIso = new Date().toISOString()
  const patch: TablesUpdate<"bookings"> = {
    previous_date: currentDate,
    previous_time: toPgTimeHm(currentTime),
    appointment_date: dateStr,
    appointment_time: toPgTimeHm(timeHm),
    last_updated_by: "customer",
    last_status_change_source: "confirm",
    last_change_type: "customer_reschedule",
    updated_at: nowIso,
  }

  const { data: updated, error: updateErr } = await admin
    .from("bookings")
    .update(patch)
    .eq("id", bookingId)
    .select("*")
    .maybeSingle()

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? "update_failed" }
  }

  return { ok: true, bookingId, booking: updated as Tables<"bookings"> }
}
