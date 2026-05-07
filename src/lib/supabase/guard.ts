import type { PostgrestError } from "@supabase/supabase-js"

export function supabaseDisabledError(): PostgrestError {
  return {
    name: "PostgrestError",
    message:
      "Supabase nie jest skonfigurowany - ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (albo fallback NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    details: "",
    hint: "",
    code: "NO_SUPABASE",
    toJSON() {
      return {
        name: this.name,
        message: this.message,
        details: this.details,
        hint: this.hint,
        code: this.code,
      }
    },
  } as PostgrestError
}

export type SupabaseResult<T> = { data: T | null; error: PostgrestError | null }

export function noClientResult<T>(): SupabaseResult<T> {
  return { data: null, error: supabaseDisabledError() }
}
