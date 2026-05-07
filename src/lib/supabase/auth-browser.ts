"use client"

import type { AuthChangeEvent, Session } from "@supabase/supabase-js"

import { getBrowserClient } from "@/lib/supabase/client"

/**
 * Etap 1: punkt zaczepienia pod formularz logowania (Etap 2).
 * Wywołaj tylko gdy `getBrowserClient()` nie zwraca `null`.
 */
export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): (() => void) | null {
  const client = getBrowserClient()
  if (!client) return null
  const { data } = client.auth.onAuthStateChange(callback)
  return () => {
    data.subscription.unsubscribe()
  }
}
