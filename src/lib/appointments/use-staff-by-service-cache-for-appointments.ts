"use client"

import * as React from "react"

import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getStaffMembersForService } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Appointment, StaffMember } from "@/types/domain"

/**
 * Cache `serviceId → staff[]` dla usług występujących w aktualnej liście wizyt (np. zmiana personelu w wierszu).
 */
export function useStaffByServiceCacheForAppointments(appointments: Appointment[]) {
  const [staffByService, setStaffByService] = React.useState<Record<string, StaffMember[]>>({})

  React.useEffect(() => {
    const ids = new Set<string>()
    for (const a of appointments) {
      const sid = typeof a.serviceId === "string" ? a.serviceId.trim() : ""
      if (sid.length > 0) ids.add(sid)
    }
    const missing = [...ids].filter((id) => staffByService[id] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    void (async () => {
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured()) return
      const bid = await getCurrentBusinessProfileIdForClient(client)
      const next: Record<string, StaffMember[]> = {}
      for (const sid of missing) {
        next[sid] = await getStaffMembersForService(client, bid, sid)
      }
      if (!cancelled) setStaffByService((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      cancelled = true
    }
  }, [appointments, staffByService])

  return { staffByService, setStaffByService }
}
