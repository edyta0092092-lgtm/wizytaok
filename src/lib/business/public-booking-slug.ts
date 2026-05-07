import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

export function normalizeBookingPublicSlug(slug: string): string {
  return slug.trim().toLowerCase()
}

export type ResolvedPublicBookingBusinessProfile = {
  /** `business_profiles.id` — identyfikator firmy dla usług, dostępności itd. */
  businessId: string | null
  businessName?: string | null
  phone?: string | null
  /** Łączny błąd dopiero gdy nie udało się ustalić profilu. */
  rpcFailed: boolean
  /** Komunikat z RPC lub z fallback SELECT (np. diagnostyka). */
  message?: string
  /** True gdy znaleziono rekord przez SELECT na tabeli zamiast poprawnego RPC. */
  usedTableFallback?: boolean
}

type RpcProfileRow = {
  id?: unknown
  business_name?: unknown
  slug?: unknown
  phone?: unknown
}

async function tryBusinessProfileSelectBySlug(
  client: SupabaseClient<Database>,
  normalizedSlug: string
): Promise<
  | { mode: "found"; id: string; businessName: string | null; phone: string | null }
  | { mode: "not_found" }
  | { mode: "error"; message: string }
> {
  const { data, error } = await client
    .from("business_profiles")
    .select("id,business_name,phone")
    .eq("slug", normalizedSlug)
    .maybeSingle()
  if (error) return { mode: "error", message: error.message }
  if (!data || typeof data.id !== "string") return { mode: "not_found" }
  const id = data.id.trim()
  if (!id) return { mode: "not_found" }
  const businessName = typeof data.business_name === "string" ? data.business_name : null
  const phone = typeof data.phone === "string" && data.phone.trim() ? data.phone.trim() : null
  return { mode: "found", id, businessName, phone }
}

/**
 * Rozwiązuje profil firmy dla publicznej strony /book/[slug].
 * 1) RPC `get_business_profile_by_slug` (security definer — domyślnie jedyna ścieżka dla anon).
 * 2) Fallback: SELECT po kolumnie `business_profiles.slug` — działa tylko jeśli polityki RLS na to pozwalają.
 *
 * Adres strony rezerwacji z ustawień aplikacji jest zapisywany jako **`slug`** (nie `booking_slug`).
 */
export async function resolvePublicBookingBusinessProfile(
  client: SupabaseClient<Database> | null,
  slug: string
): Promise<ResolvedPublicBookingBusinessProfile> {
  if (!client) return { businessId: null, rpcFailed: false }

  const normalized = normalizeBookingPublicSlug(slug)
  let rpcMessage: string | undefined

  const { data: rpcData, error: rpcError } = await client.rpc("get_business_profile_by_slug", {
    p_slug: normalized,
  })

  if (!rpcError) {
    const rowRaw = Array.isArray(rpcData) ? rpcData[0] : rpcData
    if (rowRaw && typeof rowRaw === "object") {
      const row = rowRaw as RpcProfileRow
      const id =
        typeof row.id === "string" && row.id.trim().length > 0 ? row.id.trim() : null
      if (id) {
        const businessName =
          typeof row.business_name === "string" && row.business_name.trim().length > 0
            ? row.business_name.trim()
            : null
        const phone =
          typeof row.phone === "string" && row.phone.trim().length > 0 ? row.phone.trim() : null
        return { businessId: id, businessName, phone, rpcFailed: false }
      }
    }
  } else {
    rpcMessage = rpcError.message
  }

  const fb = await tryBusinessProfileSelectBySlug(client, normalized)
  if (fb.mode === "found") {
    return {
      businessId: fb.id,
      businessName: fb.businessName,
      phone: fb.phone,
      rpcFailed: false,
      usedTableFallback: true,
      message: rpcMessage ? `rpc:${rpcMessage}; table fallback ok` : undefined,
    }
  }

  if (fb.mode === "error") {
    return {
      businessId: null,
      rpcFailed: true,
      message: rpcMessage ?? fb.message,
    }
  }

  return {
    businessId: null,
    rpcFailed: Boolean(rpcError),
    message: rpcMessage,
  }
}

/**
 * @deprecated Prefer {@link resolvePublicBookingBusinessProfile}; zostawione dla prostych wywołań.
 */
export async function resolvePublicBookingBusinessProfileId(
  client: SupabaseClient<Database> | null,
  slug: string
): Promise<{ businessId: string | null; rpcFailed: boolean; message?: string }> {
  const r = await resolvePublicBookingBusinessProfile(client, slug)
  return {
    businessId: r.businessId,
    rpcFailed: r.rpcFailed,
    message: r.message,
  }
}
