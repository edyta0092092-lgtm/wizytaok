import { NextResponse } from "next/server"

import { ensureDefaultCustomTemplatesForBusiness } from "@/lib/messages/default-custom-templates"
import { resolveAdminBusinessForUser } from "@/lib/auth/resolve-admin-business-server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

/**
 * Idempotentnie dodaje wbudowane domyślne własne szablony (np. podziękowanie po wizycie).
 */
export async function POST() {
  const resolution = await resolveAdminBusinessForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 })
  }

  try {
    const result = await ensureDefaultCustomTemplatesForBusiness(admin, resolution.businessId)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "ensure_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
