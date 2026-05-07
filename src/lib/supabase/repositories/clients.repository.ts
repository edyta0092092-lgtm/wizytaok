import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { noClientResult, type SupabaseResult } from "@/lib/supabase/guard"
import { mapClientRow } from "@/lib/supabase/mappers"
import type { Database, TablesInsert, TablesUpdate } from "@/types/database"
import type { ClientRecord } from "@/types/domain"

type Sb = SupabaseClient<Database>

function forbiddenDeleteSourceError(): PostgrestError {
  return {
    name: "PostgrestError",
    message: "client_delete_forbidden_source",
    details: "Client deletion is only allowed from clients panel.",
    hint: "Use deleteClient(..., 'clients_panel') from clients page flow.",
    code: "CLIENT_DELETE_FORBIDDEN_SOURCE",
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        details: this.details,
        hint: this.hint,
        code: this.code,
      }
    },
  } as PostgrestError
}

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
    .maybeSingle()

  if (error) return { data: null, error }
  if (!data) {
    // Update may succeed while row is not returned (e.g. strict RLS select path).
    // Treat as successful update; caller can refresh list/state separately.
    return { data: null, error: null }
  }
  return { data: mapClientRow(data), error: null }
}

export async function deleteClient(
  client: Sb | null,
  businessId: string,
  clientId: string,
  source: "clients_panel"
): Promise<SupabaseResult<null>> {
  if (!client) return noClientResult()
  if (source !== "clients_panel") {
    return {
      data: null,
      error: forbiddenDeleteSourceError(),
    }
  }
  const { error } = await client
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("business_id", businessId)

  if (error) return { data: null, error }
  return { data: null, error: null }
}
