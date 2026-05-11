import { NextResponse } from "next/server"

import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type CheckPayload = {
  email?: unknown
}

/**
 * Preflight: czy podany e-mail został już użyty do założenia profilu firmy.
 * Sprawdza wyłącznie `business_profiles.email` (case-insensitive). Nie ujawniamy
 * nazwy firmy ani innych danych konta.
 */
export async function POST(request: Request) {
  const admin = getServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "service_unconfigured", exists: false },
      { status: 503 }
    )
  }

  let body: CheckPayload
  try {
    body = (await request.json()) as CheckPayload
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json", exists: false }, { status: 400 })
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : ""
  if (emailRaw.length === 0 || emailRaw.length > 320 || !EMAIL_REGEX.test(emailRaw)) {
    return NextResponse.json({ ok: false, error: "invalid_email", exists: false }, { status: 400 })
  }

  // `ilike` bez wildcardów = porównanie case-insensitive
  const { data: rows, error } = await admin
    .from("business_profiles")
    .select("id")
    .ilike("email", emailRaw)
    .limit(1)

  if (error) {
    console.error("[check-email] query", error.message)
    return NextResponse.json({ ok: false, error: "lookup_failed", exists: false }, { status: 500 })
  }

  const exists = Boolean(rows && rows.length > 0)
  if (exists) {
    return NextResponse.json({
      ok: true,
      exists: true,
      reason: "email_already_registered" as const,
    })
  }
  return NextResponse.json({ ok: true, exists: false as const })
}
