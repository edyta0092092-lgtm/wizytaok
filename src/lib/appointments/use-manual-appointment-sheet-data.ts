"use client"

import * as React from "react"

import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { MANUAL_BOOKING_ANY_STAFF } from "@/lib/bookings/manual-booking-staff"
import {
  getCurrentBusinessProfileIdForClient,
  getLocalServices,
  getServices,
} from "@/lib/services/services-store"
import { getStaffMembersForService } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Service, StaffMember } from "@/types/domain"

/**
 * Aktywne usługi do formularza ręcznej wizyty oraz personel dla wybranej usługi (Supabase + synchronizacja wyboru).
 */
export function useManualAppointmentSheetData(
  formServiceId: string,
  setForm: React.Dispatch<React.SetStateAction<ManualAppointmentFormState>>,
) {
  const [manualServiceOptions, setManualServiceOptions] = React.useState<Service[]>([])

  React.useEffect(() => {
    let cancelled = false
    const loadManualServiceOptions = () => {
      void (async () => {
        const setActive = (list: Service[]) => {
          if (!cancelled) setManualServiceOptions(list.filter((s) => s.isActive))
        }
        if (!isSupabaseConfigured()) {
          setActive(getLocalServices())
          return
        }
        const client = getBrowserClient()
        if (!client) {
          setActive(getLocalServices())
          return
        }
        const bid = await getCurrentBusinessProfileIdForClient(client)
        if (!bid) {
          setActive(getLocalServices())
          return
        }
        try {
          const list = await getServices(client, bid)
          setActive(list)
        } catch {
          setActive([])
        }
      })()
    }
    loadManualServiceOptions()
    window.addEventListener("pw-services", loadManualServiceOptions)
    return () => {
      cancelled = true
      window.removeEventListener("pw-services", loadManualServiceOptions)
    }
  }, [])

  const [manualStaffForService, setManualStaffForService] = React.useState<StaffMember[]>([])

  React.useEffect(() => {
    let cancelled = false
    if (!formServiceId.trim()) {
      queueMicrotask(() => {
        if (!cancelled) setManualStaffForService([])
      })
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured()) {
        if (!cancelled) setManualStaffForService([])
        return
      }
      const bid = await getCurrentBusinessProfileIdForClient(client)
      const list = await getStaffMembersForService(client, bid, formServiceId.trim())
      if (!cancelled) setManualStaffForService(list)
    })()
    return () => {
      cancelled = true
    }
  }, [formServiceId])

  React.useEffect(() => {
    if (!formServiceId.trim() || manualStaffForService.length === 0) return
    if (manualStaffForService.length === 1) {
      const onlyId = manualStaffForService[0]!.id
      queueMicrotask(() => {
        setForm((f) => (f.manualStaffId === onlyId ? f : { ...f, manualStaffId: onlyId }))
      })
      return
    }
    queueMicrotask(() => {
      setForm((f) => {
        const v = f.manualStaffId.trim()
        if (v === MANUAL_BOOKING_ANY_STAFF || manualStaffForService.some((m) => m.id === v)) return f
        return { ...f, manualStaffId: MANUAL_BOOKING_ANY_STAFF }
      })
    })
  }, [formServiceId, manualStaffForService, setForm])

  return { manualServiceOptions, manualStaffForService }
}
