import type { SupabaseClient } from "@supabase/supabase-js"

import { noClientResult, type SupabaseResult } from "@/lib/supabase/guard"
import { mapTemplateRow } from "@/lib/supabase/mappers"
import type { Database, TablesInsert, TablesUpdate } from "@/types/database"
import type { MessageTemplateRecord } from "@/types/domain"

type Sb = SupabaseClient<Database>

export async function getTemplates(
  client: Sb | null,
  businessId: string
): Promise<SupabaseResult<MessageTemplateRecord[]>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("message_templates")
    .select("*")
    .eq("business_id", businessId)
    .order("title", { ascending: true })

  if (error) return { data: null, error }
  return { data: (data ?? []).map(mapTemplateRow), error: null }
}

export type CreateTemplateInput = Omit<
  TablesInsert<"message_templates">,
  "id" | "created_at" | "updated_at"
>

export async function createTemplate(
  client: Sb | null,
  payload: CreateTemplateInput
): Promise<SupabaseResult<MessageTemplateRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("message_templates")
    .insert(payload)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapTemplateRow(data), error: null }
}

export async function updateTemplate(
  client: Sb | null,
  businessId: string,
  templateId: string,
  patch: TablesUpdate<"message_templates">
): Promise<SupabaseResult<MessageTemplateRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("message_templates")
    .update(patch)
    .eq("id", templateId)
    .eq("business_id", businessId)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapTemplateRow(data), error: null }
}

export async function deleteTemplate(
  client: Sb | null,
  businessId: string,
  templateId: string
): Promise<SupabaseResult<null>> {
  if (!client) return noClientResult()
  const { error } = await client
    .from("message_templates")
    .delete()
    .eq("id", templateId)
    .eq("business_id", businessId)

  if (error) return { data: null, error }
  return { data: null, error: null }
}
