"use client"

import * as React from "react"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { businessBookingPagePath } from "@/lib/business/booking-page-path"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export function useBusinessBookingPagePath(): string {
  const { ready, businessId } = useBusinessAccess()
  const [path, setPath] = React.useState("/rezerwacje")

  React.useEffect(() => {
    if (!ready || !businessId) return
    const client = getBrowserClient()
    if (!client || !isSupabaseConfigured()) return

    let cancelled = false
    void client
      .from("business_profiles")
      .select("slug")
      .eq("id", businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setPath(businessBookingPagePath(data?.slug ?? null))
      })

    return () => {
      cancelled = true
    }
  }, [ready, businessId])

  return path
}
