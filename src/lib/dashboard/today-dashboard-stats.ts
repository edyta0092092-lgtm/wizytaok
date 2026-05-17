import { getBrowserClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type ReminderLogRow = Pick<Tables<"notification_logs">, "booking_id" | "status" | "type">
type BookingRow = Pick<Tables<"bookings">, "id" | "status" | "appointment_date">

export type TodayDashboardStats = {
  /** Potwierdzone wizyty z terminem na dziś. */
  confirmedTodayCount: number
  /** Anulowane wizyty z terminem na dziś. */
  cancelledTodayCount: number
  /** Suma kafelków dnia (potwierdzone + anulowane). */
  todayAppointmentsCount: number
  pendingTodayCount: number
  requiresActionCount: number
  reminderErrorsCount: number
}

const CANCELLED_STATUSES = new Set(["cancelled", "anulowana", "anulowane"])
const CONFIRMED_STATUSES = new Set(["confirmed", "potwierdzona", "potwierdzone"])
const PENDING_STATUSES = new Set(["pending", "to_confirm", "do_potwierdzenia", "do potwierdzenia"])
const REMINDER_TYPES = new Set([
  "reminder_24h",
  "first_reminder_24h",
  "appointment_reminder_24h",
  "second_reminder",
  "appointment_reminder_short",
  "reminder_before_visit",
])

function toLocalDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function normalizeStatus(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toLowerCase()
}

export async function getTodayDashboardStats(businessId: string): Promise<TodayDashboardStats> {
  const client = getBrowserClient()
  if (!client) {
    throw new Error("no_client")
  }

  const today = toLocalDateOnly(new Date())
  const { data: todayBookings, error: todayError } = await client
    .from("bookings")
    .select("id,status,appointment_date")
    .eq("business_id", businessId)
    .eq("appointment_date", today)

  if (todayError) {
    throw new Error(todayError.message)
  }

  const rows = (todayBookings ?? []) as BookingRow[]

  const confirmedTodayCount = rows.filter((row) =>
    CONFIRMED_STATUSES.has(normalizeStatus(row.status)),
  ).length
  const cancelledTodayCount = rows.filter((row) =>
    CANCELLED_STATUSES.has(normalizeStatus(row.status)),
  ).length
  const todayAppointmentsCount = confirmedTodayCount + cancelledTodayCount

  const pendingTodayCount = rows.filter((row) =>
    PENDING_STATUSES.has(normalizeStatus(row.status)),
  ).length

  const { data: upcomingBookingIds, error: idsError } = await client
    .from("bookings")
    .select("id,status,appointment_date")
    .eq("business_id", businessId)
    .gte("appointment_date", today)

  if (idsError) {
    throw new Error(idsError.message)
  }

  const relevantBookingIds = ((upcomingBookingIds ?? []) as BookingRow[])
    .filter((row) => !CANCELLED_STATUSES.has(normalizeStatus(row.status)))
    .map((row) => row.id)

  let reminderErrorsCount = 0
  if (relevantBookingIds.length > 0) {
    const { data: reminderErrors, error: remindersError } = await client
      .from("notification_logs")
      .select("booking_id,status,type")
      .eq("business_id", businessId)
      .eq("status", "failed")
      .in("booking_id", relevantBookingIds)

    if (remindersError) {
      throw new Error(remindersError.message)
    }

    reminderErrorsCount = ((reminderErrors ?? []) as ReminderLogRow[]).filter((row) =>
      REMINDER_TYPES.has(String(row.type ?? "").trim().toLowerCase()),
    ).length
  }

  const requiresActionCount = pendingTodayCount + reminderErrorsCount

  return {
    confirmedTodayCount,
    cancelledTodayCount,
    todayAppointmentsCount,
    pendingTodayCount,
    requiresActionCount,
    reminderErrorsCount,
  }
}
