import { NextResponse } from "next/server"

import {
  acceptBusinessInvitationForUser,
  isInvitationToken,
} from "@/lib/team/business-invitation-public"
import { getServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

type Body = { token?: string }

export async function POST(req: Request) {
  const supabase = await getServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    body = {}
  }

  const token = typeof body.token === "string" ? body.token.trim() : ""
  if (!isInvitationToken(token)) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 })
  }

  const result = await acceptBusinessInvitationForUser(
    token,
    user.id,
    user.email ?? "",
  )

  if (!result.ok) {
    const status =
      result.error === "not_authenticated"
        ? 401
        : result.error === "email_mismatch"
          ? 403
          : result.error === "not_found"
            ? 404
            : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json({ ok: true, business_id: result.businessId })
}
