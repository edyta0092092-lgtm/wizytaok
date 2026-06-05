import { NextResponse } from "next/server"

import { acceptPendingInvitationsForUser } from "@/lib/team/accept-pending-invitations"
import { getServerClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function POST() {
  const supabase = await getServerClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 500 })
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 })
  }

  const email = user.email?.trim() ?? ""
  if (!email) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 })
  }

  const result = await acceptPendingInvitationsForUser(user.id, email)

  if (!result.linked) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? "not_linked",
        detail: result.detail ?? null,
      },
      { status: result.error === "no_invitation" ? 404 : 409 },
    )
  }

  return NextResponse.json({
    ok: true,
    business_id: result.businessId ?? null,
    source: result.source ?? null,
  })
}
