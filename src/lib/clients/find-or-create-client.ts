import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

type Sb = SupabaseClient<Database>

export type FindOrCreateOutcome = "found" | "created" | "updated"

export async function findOrCreateClient(
  client: Sb | null,
  businessId: string,
  fields: { fullName: string; email: string; phone: string }
): Promise<
  | { ok: true; clientId: string; outcome: FindOrCreateOutcome }
  | { ok: false; error: string }
> {
  if (!client) return { ok: false, error: "no_client" }
  const { data, error } = await client.rpc("find_or_create_client", {
    p_business_id: businessId,
    p_full_name: fields.fullName.trim(),
    p_email: fields.email.trim(),
    p_phone: fields.phone.trim(),
  })
  if (error) {
    return { ok: false, error: error.message ?? "rpc_error" }
  }
  const row = Array.isArray(data) ? data[0] : data
  const clientId = row && typeof row === "object" && "client_id" in row ? String((row as { client_id: string }).client_id) : ""
  const outcomeRaw =
    row && typeof row === "object" && "outcome" in row ? String((row as { outcome: string }).outcome) : ""
  const outcome: FindOrCreateOutcome =
    outcomeRaw === "created" || outcomeRaw === "updated" || outcomeRaw === "found" ? outcomeRaw : "found"
  if (!clientId) return { ok: false, error: "empty_client_id" }

  if (process.env.NODE_ENV === "development") {
    console.info("[clients.findOrCreate]", {
      businessId,
      outcome,
      clientId,
    })
  }

  return { ok: true, clientId, outcome }
}
