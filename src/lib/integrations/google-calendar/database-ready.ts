import { normalizeSupabaseUrl } from "@/lib/supabase/url"

function getSupabaseAnonKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  )
}

/** Sprawdza istnienie tabeli przez publiczny REST (gdy brak service role). */
export async function probeGoogleCalendarTableViaRest(): Promise<boolean | null> {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = getSupabaseAnonKey()
  if (!url || !key) return null

  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/google_calendar_connections?select=id&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: "no-store",
      },
    )
    if (res.status === 200) return true
    const text = await res.text()
    if (res.status === 404 || text.includes("PGRST205") || text.includes("does not exist")) {
      return false
    }
    return null
  } catch {
    return null
  }
}
