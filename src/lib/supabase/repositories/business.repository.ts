import type { SupabaseClient } from "@supabase/supabase-js"

import { noClientResult, type SupabaseResult } from "@/lib/supabase/guard"
import { mapBusinessRow } from "@/lib/supabase/mappers"
import type { Database, TablesInsert, TablesUpdate } from "@/types/database"
import type { BusinessRecord } from "@/types/domain"

type Sb = SupabaseClient<Database>

export async function getBusinessByUserId(
  client: Sb | null,
  userId: string
): Promise<SupabaseResult<BusinessRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("businesses")
    .select("*")
    .eq("owner_user_id", userId)
    .maybeSingle()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapBusinessRow(data), error: null }
}

export type CreateBusinessForUserInput = Omit<
  TablesInsert<"businesses">,
  "id" | "created_at" | "updated_at"
>

export async function createBusinessForUser(
  client: Sb | null,
  payload: CreateBusinessForUserInput
): Promise<SupabaseResult<BusinessRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("businesses")
    .insert(payload)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapBusinessRow(data), error: null }
}

export async function updateBusinessById(
  client: Sb | null,
  businessId: string,
  patch: TablesUpdate<"businesses">
): Promise<SupabaseResult<BusinessRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("businesses")
    .update(patch)
    .eq("id", businessId)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapBusinessRow(data), error: null }
}
