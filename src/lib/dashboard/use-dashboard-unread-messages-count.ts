"use client"

import * as React from "react"

import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export function useDashboardUnreadMessagesCount(businessId: string | null | undefined) {
  const [count, setCount] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        if (!businessId || !isSupabaseConfigured()) {
          if (!cancelled) setCount(0)
          return
        }
        const client = getBrowserClient()
        if (!client) {
          if (!cancelled) setCount(0)
          return
        }
        const { count: failedCount, error } = await client
          .from("notification_logs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("status", "failed")

        if (!cancelled) setCount(error ? 0 : failedCount ?? 0)
      } catch {
        if (!cancelled) setCount(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  return { count, loading }
}
