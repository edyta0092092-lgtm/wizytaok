import { NextResponse } from "next/server"

import {
  prepareBusinessProfileForStartTrial,
  type PrepareBusinessProfileError,
} from "@/lib/start-trial/prepare-business-profile-server"
import { isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function httpStatusForPrepareError(e: PrepareBusinessProfileError): number {
  if (e === "unauthorized") return 401
  if (e === "no_server" || e === "missing_service_role_key") return 503
  return 422
}

/**
 * Przygotowanie business_profiles z user_metadata przed Stripe Checkout (/start-trial).
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 })
  }

  const r = await prepareBusinessProfileForStartTrial()

  if (!r.ok) {
    const showDetails = process.env.NODE_ENV !== "production"
    return NextResponse.json(
      {
        ok: false,
        error: r.error,
        supabaseMessage: showDetails ? r.supabaseMessage : undefined,
      },
      { status: httpStatusForPrepareError(r.error) }
    )
  }

  return NextResponse.json({
    ok: true,
    businessId: r.businessId,
    subscriptionStatus: r.subscriptionStatus,
    created: r.created,
    updated: r.updated,
  })
}
