import { canManageSettings, normalizeBusinessMemberPanelRole } from "@/lib/auth/permissions"
import { getServerClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export type ReferralMemberContext = {
  supabase: SupabaseClient<Database>
  userId: string
  businessId: string
  role: string
}

export async function requireReferralAdmin(): Promise<
  | { ok: true; ctx: ReferralMemberContext }
  | { ok: false; status: number; error: string }
> {
  const supabase = await getServerClient()
  if (!supabase) {
    return { ok: false, status: 500, error: "supabase_unconfigured" }
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  const { data: member, error: memberErr } = await supabase
    .from("business_members")
    .select("business_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (memberErr || !member?.business_id) {
    return { ok: false, status: 403, error: "not_a_member" }
  }

  const role = normalizeBusinessMemberPanelRole(member.role)
  if (!canManageSettings(role)) {
    return { ok: false, status: 403, error: "forbidden" }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      userId: user.id,
      businessId: member.business_id,
      role,
    },
  }
}
