"use client"

import * as React from "react"

import {
  readClientPortalProfileLocal,
  splitFullName,
  writeClientPortalProfileLocal,
} from "@/lib/client-portal/client-profile-storage"
import type {
  ClientPortalBooking,
  ClientPortalDashboard,
  ClientPortalNotification,
  ClientPortalProfile,
} from "@/lib/client-portal/types"
import { getBrowserClient } from "@/lib/supabase/client"

export function useClientPortalWorkspace(userId: string | null | undefined) {
  const [loading, setLoading] = React.useState(true)
  const [bookings, setBookings] = React.useState<ClientPortalBooking[]>([])
  const [dashboard, setDashboard] = React.useState<ClientPortalDashboard | null>(null)
  const [lastSms, setLastSms] = React.useState<ClientPortalNotification | null>(null)
  const [lastEmail, setLastEmail] = React.useState<ClientPortalNotification | null>(null)
  const [profile, setProfile] = React.useState<ClientPortalProfile | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [bookingsRes, notifRes] = await Promise.all([
        fetch("/api/client-portal/bookings", { cache: "no-store" }),
        fetch("/api/client-portal/notifications", { cache: "no-store" }),
      ])

      const bookingsJson = (await bookingsRes.json()) as {
        ok?: boolean
        bookings?: ClientPortalBooking[]
        dashboard?: ClientPortalDashboard
        error?: string
      }
      const notifJson = (await notifRes.json()) as {
        ok?: boolean
        lastSms?: ClientPortalNotification | null
        lastEmail?: ClientPortalNotification | null
        error?: string
      }

      if (!bookingsJson.ok) {
        setError(bookingsJson.error ?? "load_failed")
        return
      }

      setBookings(bookingsJson.bookings ?? [])
      setDashboard(bookingsJson.dashboard ?? null)
      if (notifJson.ok) {
        setLastSms(notifJson.lastSms ?? null)
        setLastEmail(notifJson.lastEmail ?? null)
      }

      const client = getBrowserClient()
      const email = (await client?.auth.getUser())?.data.user?.email?.trim() ?? ""
      const local = readClientPortalProfileLocal(userId)
      const meta = (await client?.auth.getUser())?.data.user?.user_metadata as Record<
        string,
        unknown
      > | undefined
      const metaFirst = typeof meta?.first_name === "string" ? meta.first_name : ""
      const metaLast = typeof meta?.last_name === "string" ? meta.last_name : ""
      setProfile({
        firstName: local?.firstName ?? metaFirst,
        lastName: local?.lastName ?? metaLast,
        phone: local?.phone ?? "",
        email,
      })
    } catch {
      setError("load_failed")
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => {
    void load()
  }, [load])

  const saveProfile = React.useCallback(
    (next: ClientPortalProfile) => {
      if (!userId) return
      writeClientPortalProfileLocal(userId, next)
      setProfile(next)
      void getBrowserClient()?.auth.updateUser({
        data: {
          account_type: "client",
          first_name: next.firstName.trim(),
          last_name: next.lastName.trim(),
        },
      })
    },
    [userId],
  )

  const cancelBooking = React.useCallback(
    async (bookingId: string, language: "pl" | "en" = "pl"): Promise<boolean> => {
      const res = await fetch("/api/client-portal/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, language }),
      })
      const json = (await res.json()) as { ok?: boolean }
      if (json.ok) {
        await load()
        return true
      }
      return false
    },
    [load],
  )

  const rescheduleBooking = React.useCallback(
    async (
      bookingId: string,
      date: string,
      time: string,
      language: "pl" | "en" = "pl",
    ): Promise<{ ok: boolean; error?: string }> => {
      const res = await fetch("/api/client-portal/reschedule-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, date, time, language }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (json.ok) {
        await load()
        return { ok: true }
      }
      return { ok: false, error: json.error }
    },
    [load],
  )

  return {
    loading,
    error,
    bookings,
    dashboard,
    lastSms,
    lastEmail,
    profile,
    saveProfile,
    cancelBooking,
    rescheduleBooking,
    reload: load,
    splitFullName,
  }
}
