import {
  getCurrentUserRole,
  normalizeBusinessMemberPanelRole,
  type PanelRole,
} from "@/lib/auth/permissions"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type ActiveBusinessMemberResolution =
  | { ok: true; userId: string; businessId: string; userEmail: string | null; effectiveRole: PanelRole }
  | { ok: false; status: number; error: string }

/**
 * Zwraca firmę dla zalogowanego właściciela lub aktywnego członka (admin lub obsługa).
 */
export async function resolveActiveBusinessMemberForUser(): Promise<ActiveBusinessMemberResolution> {
  const supabase = await getServerClient()
  if (!supabase) {
    return { ok: false, status: 500, error: "supabase_unconfigured" }
  }

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  await supabase.rpc("ensure_owner_membership")

  const { data: owned } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (owned?.id) {
    return {
      ok: true,
      userId: user.id,
      businessId: owned.id,
      userEmail: user.email ?? null,
      effectiveRole: "admin",
    }
  }

  let memberQuery = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)

  if (
    memberQuery.error?.message &&
    memberQuery.error.message.toLowerCase().includes("is_active") &&
    memberQuery.error.message.toLowerCase().includes("does not exist")
  ) {
    memberQuery = await supabase
      .from("business_members")
      .select("business_id, role")
      .eq("user_id", user.id)
      .limit(1)
  }

  const member = memberQuery.data?.[0]
  if (!member?.business_id) {
    const admin = getServiceRoleClient()
    if (admin) {
      const { data: ownedByService } = await admin
        .from("business_profiles")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle()
      if (ownedByService?.id) {
        return {
          ok: true,
          userId: user.id,
          businessId: ownedByService.id,
          userEmail: user.email ?? null,
          effectiveRole: "admin",
        }
      }
    }
    return { ok: false, status: 403, error: "no_business" }
  }

  const role = normalizeBusinessMemberPanelRole(member.role)
  const effective = getCurrentUserRole(false, role)
  if (!effective) {
    return { ok: false, status: 403, error: "forbidden" }
  }

  return {
    ok: true,
    userId: user.id,
    businessId: member.business_id,
    userEmail: user.email ?? null,
    effectiveRole: effective,
  }
}
