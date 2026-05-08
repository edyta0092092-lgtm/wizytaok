import {
  ensureBusinessProfileFromUserMetadata,
  insertBusinessProfileFromPlan,
  planBusinessProfileInsertFromUser,
} from "@/lib/supabase/ensure-profile-from-metadata"
import { getServerClient } from "@/lib/supabase/server"
import { getServiceRoleClient } from "@/lib/supabase/service-role"

export type EnsureProfileSessionResult =
  | { ok: true; hadProfile: boolean; created: boolean }
  | {
      ok: false
      error:
        | "unauthorized"
        | "no_server"
        | "service_role_required"
        | "incomplete_user_metadata"
        | "profile_insert_failed"
    }

/**
 * Gwarantuje `business_profiles` dla zalogowanego użytkownika (cookie session).
 * Najpierw zwykły klient (RLS), potem — gdy nadal brak wiersza — service role (Vercel).
 */
export async function ensureBusinessProfileForSessionUser(): Promise<EnsureProfileSessionResult> {
  const supabase = await getServerClient()
  if (!supabase) {
    return { ok: false, error: "no_server" }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "unauthorized" }
  }

  const { data: existingBefore } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (existingBefore?.id) {
    await supabase.rpc("ensure_owner_membership")
    return { ok: true, hadProfile: true, created: false }
  }

  await ensureBusinessProfileFromUserMetadata(supabase, { allowFallbackProfile: true })

  const { data: existingAfter } = await supabase
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()

  if (existingAfter?.id) {
    return { ok: true, hadProfile: false, created: true }
  }

  const plan = planBusinessProfileInsertFromUser(user, true)
  if (!plan) {
    return { ok: false, error: "incomplete_user_metadata" }
  }

  const admin = getServiceRoleClient()
  if (!admin) {
    return { ok: false, error: "service_role_required" }
  }

  const { data: raceRow } = await admin
    .from("business_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle()
  if (raceRow?.id) {
    await supabase.rpc("ensure_owner_membership")
    return { ok: true, hadProfile: true, created: false }
  }

  const inserted = await insertBusinessProfileFromPlan(admin, user.id, plan, true)
  if (inserted) {
    await supabase.rpc("ensure_owner_membership")
    return { ok: true, hadProfile: false, created: true }
  }

  return { ok: false, error: "profile_insert_failed" }
}
