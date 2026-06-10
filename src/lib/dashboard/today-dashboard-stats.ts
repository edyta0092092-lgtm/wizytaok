import { getBrowserClient } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"

type ReminderLogRow = Pick<Tables<"notification_logs">, "booking_id" | "status" | "type">
type BookingRow = Pick<Tables<"bookings">, "id" | "status" | "appointment_date" | "appointment_time">

export type TodayDashboardStats = {
  /** Potwierdzone wizyty z terminem na dziś, których godzina jeszcze nie minęła. */
  confirmedTodayCount: number
  /** Anulowane wizyty z terminem na dziś. */
  cancelledTodayCount: number
  /** Zrealizowane wizyty z terminem na dziś. */
  completedTodayCount: number
  /** Główny licznik dnia: aktywne potwierdzone wizyty. */
  todayAppointmentsCount: number
  pendingTodayCount: number
  requiresActionCount: number
  reminderErrorsCount: number
}

const CANCELLED_STATUSES = new Set(["cancelled", "anulowana", "anulowane"])
const COMPLETED_STATUSES = new Set(["completed", "zrealizowana", "zrealizowane"])
const CONFIRMED_STATUSES = new Set([
  "confirmed",
  "potwierdzona",
  "potwierdzone",
])
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

function toLocalTimeOnly(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function normalizeTime(raw: string | null | undefined): string {
  const match = String(raw ?? "").trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return "00:00"
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`
}

export async function getTodayDashboardStats(businessId: string): Promise<TodayDashboardStats> {
  const client = getBrowserClient()
  if (!client) {
    throw new Error("no_client")
  }

  const now = new Date()
  const today = toLocalDateOnly(now)
  const nowTime = toLocalTimeOnly(now)
  const [todayRes, upcomingRes] = await Promise.all([
    client
      .from("bookings")
      .select("id,status,appointment_date,appointment_time")
      .eq("business_id", businessId)
      .eq("appointment_date", today),
    client
      .from("bookings")
      .select("id,status,appointment_date,appointment_time")
      .eq("business_id", businessId)
      .gte("appointment_date", today),
  ])

  if (todayRes.error) throw new Error(todayRes.error.message)
  if (upcomingRes.error) throw new Error(upcomingRes.error.message)

  const rows = (todayRes.data ?? []) as BookingRow[]

  const confirmedTodayCount = rows.filter((row) =>
    CONFIRMED_STATUSES.has(normalizeStatus(row.status)) &&
    normalizeTime(row.appointment_time) > nowTime,
  ).length
  const cancelledTodayCount = rows.filter((row) =>
    CANCELLED_STATUSES.has(normalizeStatus(row.status)),
  ).length
  const completedTodayCount = rows.filter((row) =>
    COMPLETED_STATUSES.has(normalizeStatus(row.status)),
  ).length
  const todayAppointmentsCount = confirmedTodayCount

  const pendingTodayCount = rows.filter((row) =>
    PENDING_STATUSES.has(normalizeStatus(row.status)),
  ).length

  const relevantBookingIds = ((upcomingRes.data ?? []) as BookingRow[])
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

  const requiresActionCount = reminderErrorsCount

  return {
    confirmedTodayCount,
    cancelledTodayCount,
    completedTodayCount,
    todayAppointmentsCount,
    pendingTodayCount,
    requiresActionCount,
    reminderErrorsCount,
  }
}
