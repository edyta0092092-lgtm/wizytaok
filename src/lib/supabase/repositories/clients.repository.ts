import type { SupabaseClient } from "@supabase/supabase-js"

import { noClientResult, type SupabaseResult } from "@/lib/supabase/guard"
import { mapClientRow } from "@/lib/supabase/mappers"
import type { Database, TablesInsert, TablesUpdate } from "@/types/database"
import type { ClientRecord } from "@/types/domain"

type Sb = SupabaseClient<Database>

export async function getClients(
  client: Sb | null,
  businessId: string
): Promise<SupabaseResult<ClientRecord[]>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("clients")
    .select("*")
    .eq("business_id", businessId)
    .order("full_name", { ascending: true })

  if (error) return { data: null, error }
  return { data: (data ?? []).map(mapClientRow), error: null }
}

export type CreateClientInput = Omit<
  TablesInsert<"clients">,
  "id" | "created_at" | "updated_at"
>

export async function createClient(
  client: Sb | null,
  payload: CreateClientInput
): Promise<SupabaseResult<ClientRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("clients")
    .insert(payload)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapClientRow(data), error: null }
}

export async function updateClient(
  client: Sb | null,
  businessId: string,
  clientId: string,
  patch: TablesUpdate<"clients">
): Promise<SupabaseResult<ClientRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("clients")
    .update(patch)
    .eq("id", clientId)
    .eq("business_id", businessId)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapClientRow(data), error: null }
}

export async function deleteClient(
  client: Sb | null,
  businessId: string,
  clientId: string
): Promise<SupabaseResult<null>> {
  if (!client) return noClientResult()
  const { error } = await client
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("business_id", businessId)

  if (error) return { data: null, error }
  return { data: null, error: null }
}
