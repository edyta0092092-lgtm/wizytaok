import { NextResponse } from "next/server"

import { ensureBusinessProfileForSessionUser } from "@/lib/supabase/ensure-profile-session-server"
import { isSupabaseConfigured } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Tworzy brakujący profil firmy z metadanych użytkownika (np. po wejściu na /start-trial).
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 })
  }

  const result = await ensureBusinessProfileForSessionUser()

  if (!result.ok) {
    const status =
      result.error === "unauthorized"
        ? 401
        : result.error === "no_server"
          ? 503
          : result.error === "service_role_required"
            ? 503
            : 422
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    hadProfile: result.hadProfile,
    created: result.created,
  })
}
