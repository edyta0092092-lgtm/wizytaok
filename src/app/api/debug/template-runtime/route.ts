import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { getTemplateRuntime } from "@/lib/notifications/template-runtime"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RowSummary = {
  id: string
  type: string | null
  channel: string | null
  status: string | null
  title: string | null
  contentLength: number
  contentPreview: string
  updated_at: string | null
}

function summarizeRows(rows: Array<Record<string, unknown>>): RowSummary[] {
  return rows.map((row) => {
    const content = typeof row.content === "string" ? row.content : ""
    return {
      id: String(row.id ?? ""),
      type: (row.type as string | null) ?? null,
      channel: (row.channel as string | null) ?? null,
      status: (row.status as string | null) ?? null,
      title: (row.title as string | null) ?? null,
      contentLength: content.length,
      contentPreview: content.slice(0, 120),
      updated_at: (row.updated_at as string | null) ?? null,
    }
  })
}

/**
 * Diagnostyka: pokazuje, co serwer (service role) realnie widzi dla szablonów
 * "Potwierdzenie wizyty" danej firmy. Otwórz zalogowany w przeglądarce:
 *   /api/debug/template-runtime
 *   /api/debug/template-runtime?token=<confirmation_token_z_linku_w_mailu>
 */
export async function GET(request: Request) {
  const access = await resolveAdminBusinessForUser()
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "service_role_missing" }, { status: 500 })
  }

  const loggedBusinessId = access.businessId

  const { data: loggedRowsRaw } = await admin
    .from("message_templates")
    .select("*")
    .eq("business_id", loggedBusinessId)
    .order("updated_at", { ascending: false })

  const loggedRows = (loggedRowsRaw ?? []) as Array<Record<string, unknown>>
  const loggedRuntime = await getTemplateRuntime(admin, loggedBusinessId, "booking_confirmation")

  const result: Record<string, unknown> = {
    loggedBusinessId,
    loggedRuntime: {
      emailExists: loggedRuntime.emailExists,
      emailEnabled: loggedRuntime.emailEnabled,
      emailSubject: loggedRuntime.emailSubject,
      emailBodyLength: loggedRuntime.emailBody?.length ?? 0,
      emailBodyPreview: loggedRuntime.emailBody?.slice(0, 160) ?? null,
      smsExists: loggedRuntime.smsExists,
      smsEnabled: loggedRuntime.smsEnabled,
    },
    loggedTemplateRows: summarizeRows(loggedRows),
  }

  const url = new URL(request.url)
  const token = url.searchParams.get("token")?.trim()
  if (token) {
    const { data: bookingRaw, error: bookingErr } = await admin.rpc(
      "get_booking_by_confirmation_token",
      { p_token: token },
    )
    if (bookingErr || !bookingRaw || typeof bookingRaw !== "object") {
      result.booking = { error: bookingErr?.message ?? "booking_not_found" }
    } else {
      const o = bookingRaw as Record<string, unknown>
      const bookingBusinessId = String(o.business_id ?? "")
      const bookingRuntime = await getTemplateRuntime(admin, bookingBusinessId, "booking_confirmation")
      const { data: bookingRowsRaw } = await admin
        .from("message_templates")
        .select("*")
        .eq("business_id", bookingBusinessId)
        .order("updated_at", { ascending: false })
      result.booking = {
        bookingBusinessId,
        businessIdMatchesLogged: bookingBusinessId === loggedBusinessId,
        clientEmail: o.client_email ?? null,
        bookingRuntime: {
          emailExists: bookingRuntime.emailExists,
          emailEnabled: bookingRuntime.emailEnabled,
          emailSubject: bookingRuntime.emailSubject,
          emailBodyLength: bookingRuntime.emailBody?.length ?? 0,
          emailBodyPreview: bookingRuntime.emailBody?.slice(0, 160) ?? null,
        },
        bookingTemplateRows: summarizeRows((bookingRowsRaw ?? []) as Array<Record<string, unknown>>),
      }
    }
  }

  return NextResponse.json(result, { status: 200 })
}
