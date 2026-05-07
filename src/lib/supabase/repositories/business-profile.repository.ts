import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { resolvePublicBookingBusinessProfile } from "@/lib/business/public-booking-slug"
import { noClientResult, type SupabaseResult } from "@/lib/supabase/guard"
import { mapBusinessProfileRow } from "@/lib/supabase/mappers"
import type { Database, TablesInsert, TablesUpdate } from "@/types/database"
import type { BusinessProfileRecord, PublicBusinessProfileDisplay } from "@/types/domain"

type Sb = SupabaseClient<Database>
export const BUSINESS_PUBLIC_SLUG_COLUMN = "slug" as const

export async function getBusinessProfileByOwnerId(
  client: Sb | null,
  ownerId: string
): Promise<SupabaseResult<BusinessProfileRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("business_profiles")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapBusinessProfileRow(data), error: null }
}

export type CreateBusinessProfileInput = Omit<
  TablesInsert<"business_profiles">,
  "id" | "created_at" | "updated_at"
>

export async function insertBusinessProfile(
  client: Sb | null,
  payload: CreateBusinessProfileInput
): Promise<SupabaseResult<BusinessProfileRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("business_profiles")
    .insert(payload)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapBusinessProfileRow(data), error: null }
}

export async function updateBusinessProfileByOwnerId(
  client: Sb | null,
  ownerId: string,
  patch: TablesUpdate<"business_profiles">
): Promise<SupabaseResult<BusinessProfileRecord>> {
  if (!client) return noClientResult()
  const { data, error } = await client
    .from("business_profiles")
    .update(patch)
    .eq("owner_id", ownerId)
    .select("*")
    .single()

  if (error) return { data: null, error }
  if (!data) return { data: null, error: null }
  return { data: mapBusinessProfileRow(data), error: null }
}

export async function getPublicBusinessProfileBySlug(
  client: Sb | null,
  slug: string
): Promise<SupabaseResult<PublicBusinessProfileDisplay | null>> {
  if (!client) return noClientResult()
  const normalized = slug.trim().toLowerCase()
  const r = await resolvePublicBookingBusinessProfile(client, normalized)
  if (r.businessId) {
    return {
      data: {
        id: r.businessId,
        businessName: (r.businessName ?? "").trim(),
        slug: normalized,
        phone: r.phone ?? null,
      },
      error: null,
    }
  }
  if (!r.rpcFailed) {
    return { data: null, error: null }
  }
  const synthetic: PostgrestError = {
    name: "PostgrestError",
    message: r.message ?? "get_business_profile_by_slug",
    details: "",
    hint: "",
    code: "",
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        details: this.details,
        hint: this.hint,
        code: this.code,
      }
    },
  }
  return { data: null, error: synthetic }
}

export async function isBusinessSlugAvailable(
  client: Sb | null,
  slug: string
): Promise<SupabaseResult<boolean>> {
  if (!client) return noClientResult()
  const normalizedSlug = slug.trim().toLowerCase()

  const { data: rpcData, error: rpcError } = await client.rpc("is_business_slug_available", {
    p_slug: normalizedSlug,
  })

  if (!rpcError && typeof rpcData === "boolean") {
    return { data: rpcData, error: null }
  }

  const { data, error } = await client
    .from("business_profiles")
    .select("id")
    .eq("slug", normalizedSlug)
    .maybeSingle()

  if (!error) {
    return { data: data === null, error: null }
  }

  return { data: null, error: rpcError ?? error }
}

export type BusinessSlugAvailabilityCheck = {
  available: boolean
  error: PostgrestError | null
  rpcError: PostgrestError | null
  selectError: PostgrestError | null
  usedFallback: boolean
}

export async function checkBusinessSlugAvailability(
  client: Sb | null,
  slug: string
): Promise<BusinessSlugAvailabilityCheck> {
  if (!client) {
    return {
      available: false,
      error: null,
      rpcError: null,
      selectError: null,
      usedFallback: false,
    }
  }

  const normalizedSlug = slug.trim().toLowerCase()
  const { data: rpcData, error: rpcError } = await client.rpc("is_business_slug_available", {
    p_slug: normalizedSlug,
  })
  if (!rpcError && typeof rpcData === "boolean") {
    return {
      available: rpcData,
      error: null,
      rpcError: null,
      selectError: null,
      usedFallback: false,
    }
  }

  const { data, error: selectError } = await client
    .from("business_profiles")
    .select("id")
    .eq(BUSINESS_PUBLIC_SLUG_COLUMN, normalizedSlug)
    .maybeSingle()

  if (!selectError) {
    return {
      available: data === null,
      error: null,
      rpcError: rpcError ?? null,
      selectError: null,
      usedFallback: true,
    }
  }

  return {
    available: false,
    error: rpcError ?? selectError,
    rpcError: rpcError ?? null,
    selectError,
    usedFallback: true,
  }
}
