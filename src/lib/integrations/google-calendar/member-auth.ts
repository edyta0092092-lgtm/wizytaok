import { getServerClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export type GoogleCalendarMemberContext = {
  supabase: SupabaseClient<Database>
  userId: string
  businessId: string
  memberId: string
  staffMemberId: string | null
  role: string
}

export async function requireGoogleCalendarMember(): Promise<
  | { ok: true; ctx: GoogleCalendarMemberContext }
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
    .select("id, business_id, role, staff_member_id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (memberErr || !member?.business_id || !member.id) {
    return { ok: false, status: 403, error: "not_a_member" }
  }

  return {
    ok: true,
    ctx: {
      supabase,
      userId: user.id,
      businessId: member.business_id,
      memberId: member.id,
      staffMemberId: member.staff_member_id,
      role: member.role ?? "staff",
    },
  }
}
