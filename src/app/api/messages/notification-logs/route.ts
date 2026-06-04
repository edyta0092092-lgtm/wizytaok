import { NextResponse } from "next/server"

import { resolveActiveBusinessMemberForUser } from "@/lib/auth/resolve-active-business-member-server"
import { canViewMessageSendHistory } from "@/lib/auth/permissions"
import { getServerClient } from "@/lib/supabase/server"
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
  const resolution = await resolveActiveBusinessMemberForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }
  if (!canViewMessageSendHistory(resolution.effectiveRole)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const admin = getServiceRoleClient()
  const memberClient = admin ? null : await getServerClient()
  const reader = admin ?? memberClient
  if (!reader) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }

  const { data, error } = await reader
    .from("notification_logs")
    .select("*")
    .eq("business_id", resolution.businessId)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    businessId: resolution.businessId,
    rows: (data ?? []).map((row) => normalizeLogRow(row as Record<string, unknown>)),
    ...(admin ? {} : { readVia: "member_rls" as const }),
  })
}
