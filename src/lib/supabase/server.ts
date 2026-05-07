import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
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

export function isSupabaseConfigured(): boolean {
  return Boolean(getPublicUrl() && getPublishableKey())
}

/**
 * Klient serwerowy (App Router) — wywołuj tylko z Server Components, route handlers lub server actions.
 * Zwraca `null`, jeśli brak konfiguracji (build i strony bez Supabase działają).
 */
export async function getServerClient(): Promise<SupabaseClient<Database> | null> {
  const url = getPublicUrl()
  const key = getPublishableKey()
  if (!url || !key) return null

  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          /* wywołanie z Server Component bez mutacji ciastek — ignoruj */
        }
      },
    },
  }) as SupabaseClient<Database>
}

export type ServerSupabaseClient = SupabaseClient<Database>
