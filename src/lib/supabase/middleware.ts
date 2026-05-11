import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { User } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"
import { normalizeSupabaseUrl } from "@/lib/supabase/url"

/**
 * Odświeża ciasteczka sesji Supabase (wzorzec @supabase/ssr + Next.js middleware).
 * Zwraca też klienta supabase, by middleware mógł doczytywać dane (np. slug firmy)
 * bez tworzenia drugiej instancji.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  user: User | null
  supabase: SupabaseClient<Database>
}> {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)!
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )!.trim()

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({
          request: { headers: request.headers },
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  }) as SupabaseClient<Database>

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response: supabaseResponse, user, supabase }
}
