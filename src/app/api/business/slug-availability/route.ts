import { NextResponse } from "next/server"

import { resolveActiveBusinessMemberForUser } from "@/lib/auth/resolve-active-business-member-server"
import { canManageSettings } from "@/lib/auth/permissions"
import { isValidPublicSlugFormat, normalizePublicSlug } from "@/lib/business/slug"
import { checkBusinessSlugAvailability } from "@/lib/supabase/repositories/business-profile.repository"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const resolution = await resolveActiveBusinessMemberForUser()
  if (!resolution.ok) {
    return NextResponse.json({ ok: false, error: resolution.error }, { status: resolution.status })
  }
  if (!canManageSettings(resolution.effectiveRole)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 })
  }

  const url = new URL(request.url)
  const rawSlug = url.searchParams.get("slug") ?? ""
  const normalized = normalizePublicSlug(rawSlug)

  if (!normalized) {
    return NextResponse.json({
      ok: true,
      slug: normalized,
      state: "invalid" as const,
    })
  }

  if (!isValidPublicSlugFormat(normalized)) {
    return NextResponse.json({
      ok: true,
      slug: normalized,
      state: "invalid" as const,
    })
  }

  const admin = getServiceRoleClient()
  const reader = admin ?? (await getServerClient())
  if (!reader) {
    return NextResponse.json({ ok: false, error: "supabase_unconfigured" }, { status: 503 })
  }

  const { data: profile } = await reader
    .from("business_profiles")
    .select("slug")
    .eq("id", resolution.businessId)
    .maybeSingle()

  const currentSlug =
    typeof profile?.slug === "string" ? normalizePublicSlug(profile.slug) : ""
  if (currentSlug && currentSlug === normalized) {
    return NextResponse.json({
      ok: true,
      slug: normalized,
      state: "available" as const,
    })
  }

  const check = await checkBusinessSlugAvailability(reader, normalized)
  if (check.error) {
    return NextResponse.json({ ok: false, error: "slug_check_failed" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    slug: normalized,
    state: check.available ? ("available" as const) : ("taken" as const),
  })
}
