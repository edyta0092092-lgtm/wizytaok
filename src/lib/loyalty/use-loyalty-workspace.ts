"use client"

import * as React from "react"

import { buildCustomerCrmRows } from "@/lib/customers/build-customer-crm"
import { fetchMergedAppointments } from "@/lib/appointments/appointments-store"
import { loadClientsWorkspace } from "@/lib/clients/clients-store"
import { getBookingsForBusiness } from "@/lib/bookings/bookings-store"
import {
  computeLoyaltyDashboard,
  computeCustomerLoyaltyState,
} from "@/lib/loyalty/compute-loyalty"
import {
  DEFAULT_LOYALTY_PROGRAM,
  readLoyaltyProgram,
  writeLoyaltyProgram,
} from "@/lib/loyalty/loyalty-program-storage"
import {
  appendLoyaltyReward,
  allocateLoyaltyRewardId,
  readLoyaltyRewards,
} from "@/lib/loyalty/loyalty-reward-storage"
import type {
  LoyaltyProgramConfig,
  LoyaltyRewardRecord,
} from "@/lib/loyalty/loyalty-types"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

export function useLoyaltyWorkspace(
  businessId: string | null | undefined,
  labelFactory: Parameters<typeof computeCustomerLoyaltyState>[2],
) {
  const [ready, setReady] = React.useState(false)
  const [program, setProgram] = React.useState<LoyaltyProgramConfig | null>(null)
  const [customerRows, setCustomerRows] = React.useState<CustomerCrmRow[]>([])
  const [rewards, setRewards] = React.useState<LoyaltyRewardRecord[]>([])

  const reloadProgram = React.useCallback(() => {
    if (!businessId) {
      setProgram(null)
      return
    }
    setProgram(readLoyaltyProgram(businessId))
    setRewards(readLoyaltyRewards(businessId))
  }, [businessId])

  React.useEffect(() => {
    reloadProgram()
  }, [reloadProgram])

  React.useEffect(() => {
    if (!businessId) {
      queueMicrotask(() => {
        setCustomerRows([])
        setReady(true)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => setReady(false))

    void (async () => {
      try {
        const workspace = await loadClientsWorkspace({ businessId })
        let appointments = await fetchMergedAppointments({ businessId })
        const sb = getBrowserClient()
        if (sb && isSupabaseConfigured()) {
          const fromSb = await getBookingsForBusiness(sb, businessId, workspace.businessSlug ?? "")
          if (fromSb.length > 0) appointments = fromSb
        }
        if (!cancelled) {
          setCustomerRows(buildCustomerCrmRows(workspace.clients, appointments))
        }
      } catch {
        if (!cancelled) setCustomerRows([])
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [businessId])

  const saveProgram = React.useCallback(
    (next: LoyaltyProgramConfig) => {
      writeLoyaltyProgram(next)
      setProgram(next)
    },
    [],
  )

  const issueReward = React.useCallback(
    (input: {
      clientId: string
      clientName: string
      label: string
      visitsAtIssue: number
      pointsAtIssue: number
    }) => {
      if (!businessId || !program) return
      const record: LoyaltyRewardRecord = {
        id: allocateLoyaltyRewardId(),
        businessId,
        clientId: input.clientId,
        clientName: input.clientName,
        programKind: program.kind,
        label: input.label,
        issuedAt: new Date().toISOString(),
        visitsAtIssue: input.visitsAtIssue,
        pointsAtIssue: input.pointsAtIssue,
      }
      appendLoyaltyReward(record)
      setRewards(readLoyaltyRewards(businessId))
    },
    [businessId, program],
  )

  const activeProgram = program ?? (businessId ? DEFAULT_LOYALTY_PROGRAM(businessId) : null)

  const dashboard = React.useMemo(() => {
    if (!activeProgram) {
      return { activeParticipants: 0, rewardsIssued: 0, avgVisitsAmongParticipants: 0 }
    }
    return computeLoyaltyDashboard(customerRows, activeProgram, rewards)
  }, [activeProgram, customerRows, rewards])

  const stateForCustomer = React.useCallback(
    (row: CustomerCrmRow) => {
      if (!activeProgram) return null
      return computeCustomerLoyaltyState(row, activeProgram, labelFactory)
    },
    [activeProgram, labelFactory],
  )

  return {
    ready,
    program: activeProgram,
    customerRows,
    rewards,
    dashboard,
    saveProgram,
    issueReward,
    reloadProgram,
    stateForCustomer,
  }
}
