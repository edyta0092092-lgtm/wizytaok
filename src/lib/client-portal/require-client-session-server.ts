import type { User } from "@supabase/supabase-js"

import {
  isClientAccountUser,
  normalizeClientEmail,
} from "@/lib/client-portal/client-portal-auth"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type ClientSessionContext = {
  user: User
  email: string
  userId: string
}

async function userHasBusinessMembership(userId: string): Promise<boolean> {
  const admin = getServiceRoleClient()
  if (!admin) return false
  const { data } = await admin
    .from("business_members")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()
  return Boolean(data?.id)
}

/**
 * Sesja klienta panelu /konto.
 * Konta firmowe (aktywny business_members) bez account_type=client są odrzucane.
 */
export async function requireClientPortalSession(): Promise<
  | { ok: true; ctx: ClientSessionContext }
  | { ok: false; error: string; status: number }
> {
  const supabase = await getServerClient()
  if (!supabase) {
    return { ok: false, error: "supabase_unconfigured", status: 500 }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { ok: false, error: "unauthorized", status: 401 }
  }

  const email = normalizeClientEmail(user.email)
  if (!email) {
    return { ok: false, error: "email_required", status: 400 }
  }

  const isBusinessMember = await userHasBusinessMembership(user.id)
  if (isBusinessMember && !isClientAccountUser(user)) {
    return { ok: false, error: "business_account_not_allowed", status: 403 }
  }

  if (!isClientAccountUser(user)) {
    return { ok: false, error: "client_account_required", status: 403 }
  }

  return {
    ok: true,
    ctx: { user, email, userId: user.id },
  }
}
