import { NextResponse } from "next/server"

import {
  getBusinessInvitationPublic,
  isInvitationToken,
} from "@/lib/team/business-invitation-public"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")?.trim() ?? ""

  if (!isInvitationToken(token)) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 })
  }

  const result = await getBusinessInvitationPublic(token)
  if (!result.ok) {
    const status =
      result.error === "not_pending"
        ? 409
        : result.error === "not_found"
          ? 404
          : result.error === "supabase_unconfigured"
            ? 500
            : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json({
    ok: true,
    business_id: result.businessId,
    business_name: result.businessName,
    email: result.email,
    role: result.role,
    status: result.status,
  })
}
