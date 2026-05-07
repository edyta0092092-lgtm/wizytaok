"use client"

import * as React from "react"

import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { isStaffAvailableForSlot, MANUAL_BOOKING_ANY_STAFF } from "@/lib/bookings/manual-booking-staff"
import {
  getCurrentBusinessProfileIdForClient,
  getLocalServices,
  getServices,
} from "@/lib/services/services-store"
import { getPublicStaffForBusinessService, getStaffMembersForService } from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Service, StaffMember } from "@/types/domain"

/**
 * Aktywne usługi do formularza ręcznej wizyty oraz personel dla wybranej usługi (Supabase + synchronizacja wyboru).
 */
export function useManualAppointmentSheetData(
  businessId: string | null,
  formServiceId: string,
  formDate: string,
  formTime: string,
  setForm: React.Dispatch<React.SetStateAction<ManualAppointmentFormState>>,
) {
  const [manualServiceOptions, setManualServiceOptions] = React.useState<Service[]>([])
  const [staffReloadTick, setStaffReloadTick] = React.useState(0)
  const resolveBusinessIdForService = React.useCallback(
    async (client: ReturnType<typeof getBrowserClient>, serviceId: string): Promise<string | null> => {
      if (!client) return null
      const bid = businessId?.trim() || (await getCurrentBusinessProfileIdForClient(client))
      if (bid?.trim()) return bid.trim()
      const sid = serviceId.trim()
      if (!sid) return null
      const fromSelectedService =
        manualServiceOptions.find((s) => s.id.trim() === sid)?.businessId?.trim() ?? ""
      if (fromSelectedService) return fromSelectedService
      const firstFromCatalog = manualServiceOptions.find((s) => (s.businessId ?? "").trim().length > 0)
      return firstFromCatalog?.businessId?.trim() ?? null
    },
    [businessId, manualServiceOptions],
  )

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
    const refresh = () => setStaffReloadTick((n) => n + 1)
    window.addEventListener("pw-staff", refresh)
    window.addEventListener("pw-services", refresh)
    return () => {
      window.removeEventListener("pw-staff", refresh)
      window.removeEventListener("pw-services", refresh)
    }
  }, [])
  const [manualAvailableStaffIds, setManualAvailableStaffIds] = React.useState<Set<string> | null>(null)

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
      const bid = await resolveBusinessIdForService(client, formServiceId)
      if (!bid) {
        if (!cancelled) setManualStaffForService([])
        return
      }
      const rpcList = await getPublicStaffForBusinessService(client, bid, formServiceId.trim())
      const list =
        rpcList.length > 0 ? rpcList : await getStaffMembersForService(client, bid, formServiceId.trim())
      if (process.env.NODE_ENV === "development") {
        console.info("[appointments.manual.staffForService]", {
          businessId: bid,
          serviceId: formServiceId.trim(),
          rpcCount: rpcList.length,
          finalCount: list.length,
        })
      }
      if (!cancelled) setManualStaffForService(list)
    })()
    return () => {
      cancelled = true
    }
  }, [formServiceId, staffReloadTick, resolveBusinessIdForService])

  React.useEffect(() => {
    let cancelled = false
    if (!formServiceId.trim() || manualStaffForService.length === 0 || !formDate.trim() || !formTime.trim()) {
      queueMicrotask(() => {
        if (!cancelled) setManualAvailableStaffIds(null)
      })
      return () => {
        cancelled = true
      }
    }
    void (async () => {
      const client = getBrowserClient()
      if (!client || !isSupabaseConfigured()) {
        if (!cancelled) setManualAvailableStaffIds(null)
        return
      }
      const bid = await resolveBusinessIdForService(client, formServiceId)
      if (!bid) {
        if (!cancelled) setManualAvailableStaffIds(null)
        return
      }
      const selectedService = manualServiceOptions.find((s) => s.id === formServiceId.trim()) ?? null
      if (!selectedService) {
        if (!cancelled) setManualAvailableStaffIds(null)
        return
      }
      const available = new Set<string>()
      for (const member of manualStaffForService) {
        const ok = await isStaffAvailableForSlot({
          client,
          businessId: bid,
          staffId: member.id,
          service: {
            id: selectedService.id,
            durationMinutes: selectedService.durationMinutes,
            usesDefaultAvailability: selectedService.usesDefaultAvailability,
          },
          date: formDate,
          startTime: formTime,
        })
        if (ok) available.add(member.id)
      }
      if (!cancelled) setManualAvailableStaffIds(available)
    })()
    return () => {
      cancelled = true
    }
  }, [
    formServiceId,
    formDate,
    formTime,
    manualServiceOptions,
    manualStaffForService,
    resolveBusinessIdForService,
  ])

  React.useEffect(() => {
    if (!formServiceId.trim() || manualStaffForService.length === 0) return
    const effectiveStaff =
      manualAvailableStaffIds == null
        ? manualStaffForService
        : manualStaffForService.filter((m) => manualAvailableStaffIds.has(m.id))
    if (effectiveStaff.length === 0) {
      queueMicrotask(() => {
        setForm((f) =>
          f.manualStaffId === MANUAL_BOOKING_ANY_STAFF ? f : { ...f, manualStaffId: MANUAL_BOOKING_ANY_STAFF },
        )
      })
      return
    }
    if (effectiveStaff.length === 1) {
      const onlyId = effectiveStaff[0]!.id
      queueMicrotask(() => {
        setForm((f) => (f.manualStaffId === onlyId ? f : { ...f, manualStaffId: onlyId }))
      })
      return
    }
    queueMicrotask(() => {
      setForm((f) => {
        const v = f.manualStaffId.trim()
        if (v === MANUAL_BOOKING_ANY_STAFF || effectiveStaff.some((m) => m.id === v)) return f
        return { ...f, manualStaffId: MANUAL_BOOKING_ANY_STAFF }
      })
    })
  }, [formServiceId, manualStaffForService, manualAvailableStaffIds, setForm])

  return { manualServiceOptions, manualStaffForService, manualAvailableStaffIds }
}
