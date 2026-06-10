"use client"

import * as React from "react"

import { buildCustomerCrmRows, buildCustomerKpis } from "@/lib/customers/build-customer-crm"
import type { CustomerCrmRow, CustomerKpis } from "@/lib/customers/customer-types"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { CLIENTS_CHANGED_EVENT } from "@/lib/clients/persist-new-client"
import { loadClientsWorkspace } from "@/lib/clients/clients-store"
import { getBookingsForBusiness } from "@/lib/bookings/bookings-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Appointment } from "@/types/domain"

export type CustomersCrmState = {
  ready: boolean
  loadError: boolean
  rows: CustomerCrmRow[]
  kpis: CustomerKpis
  reload: () => void
}

export function useCustomersCrm(businessId: string | null | undefined): CustomersCrmState {
  const [ready, setReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)
  const [rows, setRows] = React.useState<CustomerCrmRow[]>([])
  const [kpis, setKpis] = React.useState<CustomerKpis>({
    totalCustomers: 0,
    newThisMonth: 0,
    returning: 0,
    lost: 0,
  })
  const [reloadToken, setReloadToken] = React.useState(0)

  const reload = React.useCallback(() => setReloadToken((n) => n + 1), [])

  React.useEffect(() => {
    const onClientsChanged = () => reload()
    window.addEventListener(CLIENTS_CHANGED_EVENT, onClientsChanged)
    return () => window.removeEventListener(CLIENTS_CHANGED_EVENT, onClientsChanged)
  }, [reload])

  React.useEffect(() => {
    if (!businessId) {
      queueMicrotask(() => {
        setRows([])
        setKpis({ totalCustomers: 0, newThisMonth: 0, returning: 0, lost: 0 })
        setReady(true)
        setLoadError(false)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setReady(false)
        setLoadError(false)
      }
    })

    void (async () => {
      try {
        const workspace = await loadClientsWorkspace({ businessId })
        let appointments: Appointment[] = []

        const sb = getBrowserClient()
        if (sb && isSupabaseConfigured()) {
          appointments = await getBookingsForBusiness(sb, businessId, workspace.businessSlug ?? "")
        }
        if (appointments.length === 0) {
          appointments = await fetchMergedAppointments({ businessId })
        }

        if (cancelled) return

        const built = buildCustomerCrmRows(workspace.clients, appointments)
        setRows(built)
        setKpis(buildCustomerKpis(built))
        setLoadError(false)
      } catch {
        if (!cancelled) {
          setLoadError(true)
          setRows([])
          setKpis({ totalCustomers: 0, newThisMonth: 0, returning: 0, lost: 0 })
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [businessId, reloadToken])

  return { ready, loadError, rows, kpis, reload }
}
