import type { SupabaseClient } from "@supabase/supabase-js"

import { getServiceRoleClient } from "@/lib/supabase/service-role"
import type { Database } from "@/types/database"

export type BusinessSubscriptionRow = {
  id: string
  subscription_status: string | null
  stripe_subscription_status: string | null
  subscription_trial_ends_at?: string | null
  trial_started_at?: string | null
  stripe_subscription_id?: string | null
}

function isMissingColumnError(message: string, column: string): boolean {
  return message.toLowerCase().includes(column.toLowerCase())
}

function readRpcSubscriptionRow(
  businessId: string,
  rpc: unknown,
): BusinessSubscriptionRow | null {
  if (!rpc || typeof rpc !== "object") return null
  const row = rpc as Record<string, unknown>
  if (row.ok !== true) return null
  return {
    id: businessId,
    subscription_status:
      typeof row.subscription_status === "string" ? row.subscription_status : null,
    stripe_subscription_status:
      typeof row.stripe_subscription_status === "string"
        ? row.stripe_subscription_status
        : null,
  }
}

async function selectProfileSubscription(
  client: SupabaseClient<Database>,
  businessId: string,
  fields: string,
): Promise<{ data: BusinessSubscriptionRow | null; error: string | null }> {
  const { data, error } = await client
    .from("business_profiles")
    .select(fields)
    .eq("id", businessId)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }
  const row = data as BusinessSubscriptionRow | null
  if (!row?.id) {
    return { data: null, error: null }
  }
  return { data: row, error: null }
}

async function loadViaUserClient(
  supabase: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessSubscriptionRow | null> {
  const fullFields =
    "id, subscription_status, stripe_subscription_status, subscription_trial_ends_at, trial_started_at, stripe_subscription_id"

  let result = await selectProfileSubscription(supabase, businessId, fullFields)
  if (result.data) return result.data

  if (result.error && isMissingColumnError(result.error, "subscription_trial_ends_at")) {
    result = await selectProfileSubscription(
      supabase,
      businessId,
      "id, subscription_status, stripe_subscription_status, trial_started_at, stripe_subscription_id",
    )
    if (result.data) return result.data
  }

  if (result.error) {
    result = await selectProfileSubscription(
      supabase,
      businessId,
      "id, subscription_status, stripe_subscription_status",
    )
    if (result.data) return result.data
  }

  const { data: rpc } = await supabase.rpc("get_business_member_subscription_access", {
    p_business_id: businessId,
  })
  return readRpcSubscriptionRow(businessId, rpc)
}

async function loadViaServiceRole(
  admin: SupabaseClient<Database>,
  userId: string,
  businessId: string,
): Promise<BusinessSubscriptionRow | null> {
  const { data: membership } = await admin
    .from("business_members")
    .select("id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .limit(1)

  if (!membership?.length) return null

  const fullFields =
    "id, subscription_status, stripe_subscription_status, subscription_trial_ends_at, trial_started_at, stripe_subscription_id"

  let result = await selectProfileSubscription(admin, businessId, fullFields)
  if (result.data) return result.data

  if (result.error && isMissingColumnError(result.error, "subscription_trial_ends_at")) {
    result = await selectProfileSubscription(
      admin,
      businessId,
      "id, subscription_status, stripe_subscription_status, trial_started_at, stripe_subscription_id",
    )
    if (result.data) return result.data
  }

  return (
    await selectProfileSubscription(
      admin,
      businessId,
      "id, subscription_status, stripe_subscription_status",
    )
  ).data
}

/**
 * Status subskrypcji firmy dla członka — najpierw sesja użytkownika (RLS), potem service role.
 */
export async function loadBusinessMemberSubscription(
  supabase: SupabaseClient<Database>,
  userId: string,
  businessId: string,
): Promise<BusinessSubscriptionRow | null> {
  const userRow = await loadViaUserClient(supabase, businessId)
  const admin = getServiceRoleClient()
  if (!admin) return userRow

  const adminRow = await loadViaServiceRole(admin, userId, businessId)
  return adminRow ?? userRow
}
