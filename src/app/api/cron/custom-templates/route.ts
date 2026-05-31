import { NextResponse, type NextRequest } from "next/server"

import {
  sendCustomTemplateForBookingDedup,
  type CustomTemplateBookingRow,
  type CustomTemplateBusinessRow,
  type CustomTemplateRow,
} from "@/lib/notifications/custom-template-send"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Tables } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const BATCH_SIZE = 30
const DUE_WINDOW_MINUTES = 720

/**
 * Cron wysyłający własne szablony typu `schedule_before` / `schedule_after`.
 *
 * Wymagane envy:
 *   - CRON_SECRET
 *   - SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL
 *   - RESEND_API_KEY (e-mail) / konfiguracja SMS (jak w send-reminders)
 *
 * Wywołanie:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/custom-templates
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = req.headers.get("authorization")?.trim()
  return header === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

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

async function handle(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }
  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  const { data: dueRaw, error: dueErr } = await admin.rpc("due_custom_templates", {
    p_window_minutes: DUE_WINDOW_MINUTES,
  })
  if (dueErr) {
    return NextResponse.json({ ok: false, error: dueErr.message }, { status: 500 })
  }
  const due = ((dueRaw ?? []) as Array<{
    template_id: string
    booking_id: string
    business_id: string
  }>).slice(0, BATCH_SIZE)
  if (due.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0 })
  }

  const templateCache = new Map<string, CustomTemplateRow | null>()
  const businessCache = new Map<string, CustomTemplateBusinessRow | null>()

  async function getTemplate(id: string): Promise<CustomTemplateRow | null> {
    if (templateCache.has(id)) return templateCache.get(id) ?? null
    const { data } = await admin!.from("custom_templates").select("*").eq("id", id).maybeSingle()
    const row = (data as CustomTemplateRow | null) ?? null
    templateCache.set(id, row)
    return row
  }
  async function getBusiness(id: string): Promise<CustomTemplateBusinessRow | null> {
    if (businessCache.has(id)) return businessCache.get(id) ?? null
    const { data } = await admin!.from("business_profiles").select(BUSINESS_COLS).eq("id", id).maybeSingle()
    const row = (data as CustomTemplateBusinessRow | null) ?? null
    businessCache.set(id, row)
    return row
  }

  let processed = 0
  let sent = 0
  for (const item of due) {
    processed += 1
    try {
      const template = await getTemplate(item.template_id)
      const business = await getBusiness(item.business_id)
      if (!template || !business) continue
      const { data: bookingRaw } = await admin
        .from("bookings")
        .select("*")
        .eq("id", item.booking_id)
        .maybeSingle()
      if (!bookingRaw) continue
      const bookingStatus = String((bookingRaw as { status?: string }).status ?? "").trim()
      if (bookingStatus === "cancelled" || bookingStatus === "completed" || bookingStatus === "no_show") {
        continue
      }
      const booking = toBookingRow(bookingRaw as Tables<"bookings">)
      const outcomes = await sendCustomTemplateForBookingDedup(admin, { template, booking, business })
      sent += outcomes.filter((o) => o.status === "sent").length
    } catch {
      // pojedyncza wizyta nie zatrzymuje paczki
    }
  }

  return NextResponse.json({ ok: true, processed, sent })
}
