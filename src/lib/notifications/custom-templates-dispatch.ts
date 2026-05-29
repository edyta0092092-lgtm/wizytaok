import {
  sendCustomTemplateForBookingDedup,
  type CustomTemplateBookingRow,
  type CustomTemplateBusinessRow,
  type CustomTemplateRow,
} from "@/lib/notifications/custom-template-send"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables } from "@/types/database"

export type CustomTemplateEventKey =
  | "created"
  | "confirmed"
  | "cancelled"
  | "no_show"
  | "completed"

const BUSINESS_COLS = "id, slug, phone, contact_phone, business_name, business_address"

function toBookingRow(row: Tables<"bookings">): CustomTemplateBookingRow {
  return {
    id: row.id,
    business_id: row.business_id,
    client_name: row.client_name ?? null,
    client_email: row.client_email ?? null,
    client_phone: row.client_phone ?? null,
    service_name: row.service_name ?? null,
    appointment_date: row.appointment_date,
    appointment_time: row.appointment_time,
    staff_name: (row as { staff_name?: string | null }).staff_name ?? null,
    confirmation_token: (row as { confirmation_token?: string | null }).confirmation_token ?? null,
  }
}

/**
 * Wysyła wszystkie aktywne własne szablony typu `event` przypisane do danego zdarzenia.
 * Używa service role + deduplikacji (jedna wysyłka na wizytę/szablon/kanał).
 * Bezpieczne fire-and-forget: nie rzuca, zwraca liczbę wysłanych kanałów.
 */
export async function dispatchCustomTemplatesForEvent(args: {
  bookingId: string
  eventKey: CustomTemplateEventKey
}): Promise<{ sent: number; matched: number }> {
  const admin = getServiceRoleClient()
  if (!admin) return { sent: 0, matched: 0 }

  const { data: bookingRaw } = await admin
    .from("bookings")
    .select("*")
    .eq("id", args.bookingId)
    .maybeSingle()
  if (!bookingRaw) return { sent: 0, matched: 0 }
  const bookingRow = bookingRaw as Tables<"bookings">
  const booking = toBookingRow(bookingRow)

  const { data: businessRaw } = await admin
    .from("business_profiles")
    .select(BUSINESS_COLS)
    .eq("id", booking.business_id)
    .maybeSingle()
  if (!businessRaw) return { sent: 0, matched: 0 }
  const business = businessRaw as CustomTemplateBusinessRow

  const { data: templatesRaw } = await admin
    .from("custom_templates")
    .select("*")
    .eq("business_id", booking.business_id)
    .eq("trigger_type", "event")
    .eq("event_key", args.eventKey)
    .eq("status", "active")
  const templates = (templatesRaw ?? []) as CustomTemplateRow[]
  if (templates.length === 0) return { sent: 0, matched: 0 }

  let sent = 0
  for (const template of templates) {
    try {
      const outcomes = await sendCustomTemplateForBookingDedup(admin, { template, booking, business })
      sent += outcomes.filter((o) => o.status === "sent").length
    } catch {
      // pojedynczy szablon nie może zatrzymać reszty
    }
  }
  return { sent, matched: templates.length }
}
