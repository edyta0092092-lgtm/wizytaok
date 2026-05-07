import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import { normalizeSupabaseUrl } from "@/lib/supabase/url"

function getPublicUrl(): string | undefined {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
}

function getPublishableKey(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined
}

/** true, gdy można utworzyć klienta przeglądarki (bez rzucania wyjątków przy pustych env). */
export function isSupabaseConfigured(): boolean {
  return Boolean(getPublicUrl() && getPublishableKey())
}

/**
 * Klient przeglądarki — używaj wyłącznie w komponentach klienckich lub hookach.
 * Zwraca `null`, jeśli brak zmiennych środowiskowych (UI nadal działa).
 */
export function getBrowserClient(): SupabaseClient<Database> | null {
  const url = getPublicUrl()
  const key = getPublishableKey()
  if (!url || !key) return null
  // Rzutowanie: wersje @supabase/ssr i typów Database mogą różnić się liczbą parametrów generycznych.
  return createBrowserClient(url, key) as SupabaseClient<Database>
}

export type BrowserSupabaseClient = SupabaseClient<Database>
