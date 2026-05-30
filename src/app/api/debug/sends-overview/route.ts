import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

type CountMap = Record<string, number>

function tally(rows: Array<{ status: string | null }> | null): CountMap {
  const out: CountMap = {}
  for (const r of rows ?? []) {
    const key = (r.status ?? "").trim() || "(empty)"
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

export async function GET() {
  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }
  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }
  const businessId = resolution.businessId

  const [logsRes, customRes, bookingsRes, logsGlobalRes, customGlobalRes, bookingsGlobalRes] =
    await Promise.all([
      admin
        .from("notification_logs")
        .select("id,status,type,channel,error_message,created_at,sent_at,booking_id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("custom_template_sends")
        .select("id,status,channel,last_error,created_at,sent_at,failed_at,skipped_at,custom_template_id,appointment_id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("bookings")
        .select("id,business_id,status,created_at,client_email,client_phone")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("notification_logs")
        .select("business_id")
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("custom_template_sends")
        .select("business_id")
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("bookings")
        .select("business_id")
        .order("created_at", { ascending: false })
        .limit(1000),
    ])

  const logsRows = (logsRes.data ?? []) as Array<{
    id: string
    status: string | null
    type: string | null
    channel: string | null
    error_message: string | null
    created_at: string
    sent_at: string | null
    booking_id: string | null
  }>
  const customRows = (customRes.data ?? []) as Array<{
    id: string
    status: string | null
    channel: string | null
    last_error: string | null
    created_at: string
    sent_at: string | null
    failed_at: string | null
    skipped_at: string | null
    custom_template_id: string
    appointment_id: string
  }>

  const bookingsRows = (bookingsRes.data ?? []) as Array<{
    id: string
    business_id: string
    status: string | null
    created_at: string
    client_email: string | null
    client_phone: string | null
  }>

  function distinctBusinessCounts(
    rows: Array<{ business_id: string | null }> | null,
  ): { distinct: number; counts: CountMap } {
    const counts: CountMap = {}
    for (const r of rows ?? []) {
      const key = r.business_id ?? "(null)"
      counts[key] = (counts[key] ?? 0) + 1
    }
    return { distinct: Object.keys(counts).length, counts }
  }

  return NextResponse.json({
    ok: true,
    businessId,
    notification_logs: {
      tableError: logsRes.error?.message ?? null,
      total: logsRows.length,
      byStatus: tally(logsRows),
      recent: logsRows.slice(0, 15),
    },
    custom_template_sends: {
      tableError: customRes.error?.message ?? null,
      total: customRows.length,
      byStatus: tally(customRows),
      recent: customRows.slice(0, 15),
    },
    bookings_for_business: {
      tableError: bookingsRes.error?.message ?? null,
      total: bookingsRows.length,
      recent: bookingsRows.slice(0, 10).map((b) => ({
        id: b.id,
        status: b.status,
        created_at: b.created_at,
        hasEmail: Boolean(b.client_email?.trim()),
        hasPhone: Boolean(b.client_phone?.trim()),
      })),
    },
    global: {
      notification_logs: distinctBusinessCounts(
        (logsGlobalRes.data ?? []) as Array<{ business_id: string | null }>,
      ),
      custom_template_sends: distinctBusinessCounts(
        (customGlobalRes.data ?? []) as Array<{ business_id: string | null }>,
      ),
      bookings: distinctBusinessCounts(
        (bookingsGlobalRes.data ?? []) as Array<{ business_id: string | null }>,
      ),
    },
  })
}
