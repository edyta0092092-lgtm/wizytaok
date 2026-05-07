"use client"

import * as React from "react"

import { buildStaffFilterOptions, getStaffForCurrentBusiness } from "@/lib/staff/staff-store"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { Appointment, StaffMember } from "@/types/domain"

export function useAppointmentsStaffForFilters(
  appointments: Appointment[],
  staffFilter: StaffAppointmentFilterValue,
  setStaffFilterAndUrl: (next: StaffAppointmentFilterValue) => void,
) {
  const [allStaffMembers, setAllStaffMembers] = React.useState<StaffMember[]>([])
  const [staffLoading, setStaffLoading] = React.useState(false)
  const [staffLoadError, setStaffLoadError] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    const loadStaff = () => {
      void (async () => {
        setStaffLoading(true)
        setStaffLoadError(false)
        try {
          const list = await getStaffForCurrentBusiness()
          if (!cancelled) setAllStaffMembers(list)
        } catch {
          if (!cancelled) {
            setAllStaffMembers([])
            setStaffLoadError(true)
          }
        } finally {
          if (!cancelled) setStaffLoading(false)
        }
      })()
    }
    loadStaff()
    window.addEventListener("pw-staff", loadStaff)
    return () => {
      cancelled = true
      window.removeEventListener("pw-staff", loadStaff)
    }
  }, [])

  const staffErrorUrlResetDone = React.useRef(false)
  React.useEffect(() => {
    if (!staffLoadError) {
      staffErrorUrlResetDone.current = false
      return
    }
    if (staffErrorUrlResetDone.current) return
    staffErrorUrlResetDone.current = true
    queueMicrotask(() => setStaffFilterAndUrl("all"))
  }, [staffLoadError, setStaffFilterAndUrl])

  const appointmentStaffIdSet = React.useMemo(() => {
    const s = new Set<string>()
    for (const a of appointments) {
      const id = typeof a.staffId === "string" ? a.staffId.trim() : ""
      if (id.length > 0) s.add(id)
    }
    return s
  }, [appointments])

  const staffSelectOptions = React.useMemo(
    () => buildStaffFilterOptions(allStaffMembers, appointmentStaffIdSet),
    [allStaffMembers, appointmentStaffIdSet],
  )

  React.useEffect(() => {
    if (staffLoading || staffLoadError) return
    if (staffFilter === "all" || staffFilter === "unassigned") return
    const ok = staffSelectOptions.some((m) => m.id === staffFilter)
    if (ok) return
    queueMicrotask(() => setStaffFilterAndUrl("all"))
  }, [staffLoading, staffLoadError, staffFilter, staffSelectOptions, setStaffFilterAndUrl])

  return { allStaffMembers, staffLoading, staffLoadError, staffSelectOptions }
}
