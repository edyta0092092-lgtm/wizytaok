import type { SupabaseClient } from "@supabase/supabase-js"

import { noClientResult, type SupabaseResult } from "@/lib/supabase/guard"
import { mapAppointmentRow } from "@/lib/supabase/mappers"
import type { Database, TablesInsert, TablesUpdate } from "@/types/database"
import type { AppointmentRecord } from "@/types/domain"

type Sb = SupabaseClient<Database>

export async function getAppointments(
  client: Sb | null,
  businessId: string
): Promise<SupabaseResult<AppointmentRecord[]>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("appointments")
    .select("*")
    .eq("business_id", businessId)
    .order("starts_at", { ascending: true })

  if (error) return { data: null, error }
  return { data: (data ?? []).map(mapAppointmentRow), error: null }
}

export type CreateAppointmentInput = Omit<
  TablesInsert<"appointments">,
  "id" | "created_at" | "updated_at"
>

export async function createAppointment(
  client: Sb | null,
  payload: CreateAppointmentInput
): Promise<SupabaseResult<AppointmentRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("appointments")
    .insert(payload)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapAppointmentRow(data), error: null }
}

export async function updateAppointment(
  client: Sb | null,
  businessId: string,
  appointmentId: string,
  patch: TablesUpdate<"appointments">
): Promise<SupabaseResult<AppointmentRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("appointments")
    .update(patch)
    .eq("id", appointmentId)
    .eq("business_id", businessId)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapAppointmentRow(data), error: null }
}

export async function deleteAppointment(
  client: Sb | null,
  businessId: string,
  appointmentId: string
): Promise<SupabaseResult<null>> {
  if (!client) return noClientResult()
  const { error } = await client
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("business_id", businessId)

  if (error) return { data: null, error }
  return { data: null, error: null }
}
