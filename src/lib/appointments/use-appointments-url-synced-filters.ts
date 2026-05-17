"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  normalizeAppointmentsStatusFilterFromUrl,
  type AppointmentsListFilter,
} from "@/lib/appointments/appointments-list-filters"
import type { AppointmentSourceFilter } from "@/lib/bookings/booking-source"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"

/**
 * Stan filtrów listy wizyt zsynchronizowany z query string (?filter ?status ?date ?source ?staff).
 * `setFilter` nie zapisuje URL (jak wcześniej na stronie) — tylko przyciski statusów lokalnie.
 */
export function useAppointmentsUrlSyncedFilters() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const [filter, setFilter] = React.useState<AppointmentsListFilter>("all")
  const [sourceFilter, setSourceFilter] = React.useState<AppointmentSourceFilter>("all")
  const [staffFilter, setStaffFilter] = React.useState<StaffAppointmentFilterValue>("all")
  const [restrictToToday, setRestrictToToday] = React.useState(false)

  React.useEffect(() => {
    const filterParam = searchParams.get("filter")
    const status = searchParams.get("status")
    const dateParam = searchParams.get("date")

    queueMicrotask(() => setRestrictToToday(dateParam === "today"))

    const legacyFilter =
      filterParam === "needs_action" ||
      filterParam === "needs_contact" ||
      filterParam === "unconfirmed"

    if (!filterParam && !status && !legacyFilter) return

    const fromUrl = normalizeAppointmentsStatusFilterFromUrl(
      legacyFilter ? null : filterParam ?? status,
    )
    queueMicrotask(() => setFilter(fromUrl))
  }, [searchParams])

  React.useEffect(() => {
    const src = searchParams.get("source")
    if (src === "manual_admin" || src === "manual_staff") {
      const p = new URLSearchParams(searchParams.toString())
      p.set("source", "manual")
      const q = p.toString()
      queueMicrotask(() => {
        setSourceFilter("manual")
        router.replace(q ? `${pathname}?${q}` : pathname)
      })
      return
    }
    if (src === "online") {
      queueMicrotask(() => setSourceFilter("online"))
    } else if (src === "manual") {
      queueMicrotask(() => setSourceFilter("manual"))
    } else {
      queueMicrotask(() => setSourceFilter("all"))
    }
  }, [searchParams, pathname, router])

  const setSourceFilterAndUrl = React.useCallback(
    (next: AppointmentSourceFilter) => {
      setSourceFilter(next)
      const p = new URLSearchParams(searchParams.toString())
      if (next === "all") p.delete("source")
      else p.set("source", next)
      const q = p.toString()
      router.replace(q ? `${pathname}?${q}` : pathname)
    },
    [pathname, router, searchParams]
  )

  const setStaffFilterAndUrl = React.useCallback(
    (next: StaffAppointmentFilterValue) => {
      setStaffFilter(next)
      const p = new URLSearchParams(searchParams.toString())
      if (next === "all") p.delete("staff")
      else if (next === "unassigned") p.set("staff", "unassigned")
      else p.set("staff", next)
      const q = p.toString()
      router.replace(q ? `${pathname}?${q}` : pathname)
    },
    [pathname, router, searchParams]
  )

  React.useEffect(() => {
    const st = searchParams.get("staff")
    if (!st || st === "all") {
      queueMicrotask(() => setStaffFilter("all"))
    } else if (st === "unassigned") {
      queueMicrotask(() => setStaffFilter("unassigned"))
    } else {
      queueMicrotask(() => setStaffFilter(st))
    }
  }, [searchParams])

  return {
    filter,
    setFilter,
    sourceFilter,
    staffFilter,
    restrictToToday,
    setSourceFilterAndUrl,
    setStaffFilterAndUrl,
  }
}
