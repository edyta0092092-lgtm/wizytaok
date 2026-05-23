import { NextResponse } from "next/server"

import { evaluateTrialStartEligibility } from "@/lib/billing/trial-eligibility-server"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Sprawdza, czy zalogowany użytkownik może rozpocząć trial (cross-provider / cross-profile).
 */
export async function GET() {
  const supabase = await getServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_unconfigured" }, { status: 503 })
  }

  const { data: owned } = await admin
    .from("business_profiles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle()

  const evaluation = await evaluateTrialStartEligibility(admin, {
    userId: user.id,
    userEmail: user.email,
    businessProfile: (owned as Database["public"]["Tables"]["business_profiles"]["Row"] | null) ?? null,
  })

  if (evaluation.blocked) {
    return NextResponse.json({
      ok: true,
      eligible: false,
      blocked: true,
      reason: evaluation.reason,
      message: evaluation.message,
    })
  }

  return NextResponse.json({
    ok: true,
    eligible: true,
    blocked: false,
    message: null,
    hasBusinessProfile: Boolean(owned?.id),
  })
}
