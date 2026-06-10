"use client"

import * as React from "react"

import type { SmsQuotaWarningLevel } from "@/lib/notifications/sms-quota-guard"

type SmsOverviewResponse = {
  ok?: boolean
  quota?: {
    used: number
    limit: number
    remaining: number | null
    countFailed: boolean
    warningLevel?: SmsQuotaWarningLevel
  }
}

export function useDashboardSmsQuota() {
  const [loading, setLoading] = React.useState(true)
  const [data, setData] = React.useState<SmsOverviewResponse | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/business/sms-overview", { cache: "no-store" })
        const json = (await res.json()) as SmsOverviewResponse
        if (!cancelled) setData(json.ok ? json : null)
      } catch {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const quota = data?.quota
  return {
    loading,
    used: quota && !quota.countFailed ? quota.used : null,
    limit: quota && !quota.countFailed ? quota.limit : null,
    warningLevel: quota?.warningLevel ?? "none",
  }
}
