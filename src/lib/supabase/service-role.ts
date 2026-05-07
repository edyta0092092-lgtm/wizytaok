import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import { normalizeSupabaseUrl } from "@/lib/supabase/url"

/**
 * Klient Supabase z service role - tylko po stronie serwera (Route Handlers, Server Actions).
 * Nigdy nie importuj w komponentach klienckich ani nie używaj NEXT_PUBLIC_* dla klucza.
 */
export function getServiceRoleClient(): SupabaseClient<Database> | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
