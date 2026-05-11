import { NextResponse } from "next/server"

import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REGISTERED = "registered_business"
const UNREGISTERED = "unregistered_activity"

function normalizeDigits(raw: string | null | undefined): string {
  if (typeof raw !== "string") return ""
  return raw.replace(/\D/g, "")
}

type CheckPayload = {
  account_type?: unknown
  company_tax_id?: unknown
  contact_phone?: unknown
}

/**
 * Preflight przed signup: sprawdź czy NIP lub telefon już są w bazie (bez ujawniania nazw firm).
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

  const accountType = typeof body.account_type === "string" ? body.account_type.trim() : ""
  if (accountType !== REGISTERED && accountType !== UNREGISTERED) {
    return NextResponse.json({ ok: false, error: "invalid_account_type", exists: false }, { status: 400 })
  }

  if (accountType === REGISTERED) {
    const taxRaw =
      typeof body.company_tax_id === "string" ? body.company_tax_id : String(body.company_tax_id ?? "")
    const nip = normalizeDigits(taxRaw)
    if (nip.length !== 10) {
      return NextResponse.json({ ok: false, error: "invalid_company_tax_id", exists: false }, { status: 400 })
    }

    const { data: rows, error } = await admin
      .from("business_profiles")
      .select("id")
      .eq("company_tax_id_normalized", nip)
      .limit(1)

    if (error) {
      console.error("[check-business-identity] nip query", error.message)
      return NextResponse.json({ ok: false, error: "lookup_failed", exists: false }, { status: 500 })
    }

    const exists = Boolean(rows && rows.length > 0)
    if (exists) {
      return NextResponse.json({
        ok: true,
        exists: true,
        reason: "tax_id_already_registered" as const,
      })
    }
    return NextResponse.json({ ok: true, exists: false as const })
  }

  const phoneRaw =
    typeof body.contact_phone === "string"
      ? body.contact_phone
      : String(body.contact_phone ?? "")
  const phoneNorm = normalizeDigits(phoneRaw)
  if (phoneNorm.length < 9) {
    return NextResponse.json({ ok: false, error: "invalid_contact_phone", exists: false }, { status: 400 })
  }

  const { data: rows, error } = await admin
    .from("business_profiles")
    .select("id")
    .eq("contact_phone_normalized", phoneNorm)
    .limit(1)

  if (error) {
    console.error("[check-business-identity] phone query", error.message)
    return NextResponse.json({ ok: false, error: "lookup_failed", exists: false }, { status: 500 })
  }

  const exists = Boolean(rows && rows.length > 0)
  if (exists) {
    return NextResponse.json({
      ok: true,
      exists: true,
      reason: "phone_already_registered" as const,
    })
  }

  return NextResponse.json({ ok: true, exists: false as const })
}
