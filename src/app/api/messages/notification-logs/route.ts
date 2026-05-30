import { NextResponse } from "next/server"

import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

function normalizeLogRow(raw: Record<string, unknown>) {
  const errorMessage =
    typeof raw.error_message === "string"
      ? raw.error_message
      : typeof raw.error === "string"
        ? raw.error
        : null
  return {
    ...raw,
    error_message: errorMessage,
  }
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

  const { data, error } = await admin
    .from("notification_logs")
    .select("*")
    .eq("business_id", resolution.businessId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    businessId: resolution.businessId,
    rows: (data ?? []).map((row) => normalizeLogRow(row as Record<string, unknown>)),
  })
}
