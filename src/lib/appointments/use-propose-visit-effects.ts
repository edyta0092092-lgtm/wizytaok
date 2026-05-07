"use client"

import * as React from "react"

import { coerceServiceIdValue } from "@/lib/bookings/coerce-service-id"
import { MANUAL_BOOKING_ANY_STAFF, isStaffAvailableForSlot } from "@/lib/bookings/manual-booking-staff"
import {
  hasStaffSchedulingIntervalOverlap,
} from "@/lib/bookings/slot-availability"
import { isTimeInsideRange } from "@/lib/bookings/time-hm"
import { unwrapSupabaseBookingAppointmentId } from "@/lib/bookings/bookings-store"
import { mapProposeStaffDbRow } from "@/lib/staff/map-propose-staff-db-row"
import { mergeStaffMembersById } from "@/lib/staff/staff-members-merge"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import {
  getStaffAvailabilityContextForBusiness,
  getStaffMembersForService,
  getServiceStaffForPublicSlug,
  publicBookingServiceIdsMatch,
} from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Appointment, Service, StaffMember } from "@/types/domain"

export function useProposeStaffIdFromStaffByServiceEffect(args: {
  proposeForId: string | null
  proposeServiceId: string
  staffByService: Record<string, StaffMember[]>
  setProposeStaffId: React.Dispatch<React.SetStateAction<string>>
}): void {
  const { proposeForId, proposeServiceId, staffByService, setProposeStaffId } = args
  React.useEffect(() => {
    if (!proposeForId || !proposeServiceId) return
    const list = staffByService[proposeServiceId]
    if (!list) return
    if (list.length === 1) {
      const only = list[0]!.id
      queueMicrotask(() => {
        setProposeStaffId((prev) => (prev === only ? prev : only))
      })
      return
    }
    queueMicrotask(() => {
      setProposeStaffId((prev) => {
        if (prev === MANUAL_BOOKING_ANY_STAFF) return prev
        if (list.some((m) => m.id === prev)) return prev
        return MANUAL_BOOKING_ANY_STAFF
      })
    })
  }, [proposeForId, proposeServiceId, staffByService, setProposeStaffId])
}

export function useProposeAvailableStaffLoadEffect(args: {
  proposeForId: string | null
  proposeDate: string
  proposeTime: string
  proposeResolvedServiceId: string
  appointments: Appointment[]
  manualServiceOptions: Service[]
  t: (key: string) => string
  setProposeAvailableStaffIds: React.Dispatch<React.SetStateAction<Set<string> | null>>
  setProposeStaffListForService: React.Dispatch<React.SetStateAction<StaffMember[] | null>>
  setIsCheckingProposeStaff: React.Dispatch<React.SetStateAction<boolean>>
  setProposeResolvedServiceId: React.Dispatch<React.SetStateAction<string>>
}): void {
  const {
    proposeForId,
    proposeDate,
    proposeTime,
    proposeResolvedServiceId,
    appointments,
    manualServiceOptions,
    t,
    setProposeAvailableStaffIds,
    setProposeStaffListForService,
    setIsCheckingProposeStaff,
    setProposeResolvedServiceId,
  } = args

  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!proposeForId || !proposeDate.trim() || !proposeTime.trim()) {
        if (!cancelled) {
          setProposeAvailableStaffIds(null)
          setProposeStaffListForService(null)
          setIsCheckingProposeStaff(false)
        }
        return
      }
      const row = appointments.find((a) => a.id === proposeForId)
      if (!row) {
        if (!cancelled) {
          setProposeAvailableStaffIds(null)
          setProposeStaffListForService(null)
          setIsCheckingProposeStaff(false)
        }
        return
      }
      const resolverClient = getBrowserClient()
      let bidResolved =
        resolverClient && isSupabaseConfigured()
          ? await getCurrentBusinessProfileIdForClient(resolverClient)
          : null
      const uuidSb = unwrapSupabaseBookingAppointmentId(row.id)
      let serviceKey = proposeResolvedServiceId.trim() || row.serviceId?.trim() || ""
      if (resolverClient && uuidSb) {
        const { data: bookingRow } = await resolverClient
          .from("bookings")
          .select("business_id, service_id")
          .eq("id", uuidSb)
          .maybeSingle()
        const b = typeof bookingRow?.business_id === "string" ? bookingRow.business_id.trim() : ""
        if (b) bidResolved = bidResolved ?? b
        const sid = typeof bookingRow?.service_id === "string" ? bookingRow.service_id.trim() : ""
        if (sid) {
          serviceKey = sid
          if (!cancelled) {
            setProposeResolvedServiceId(sid)
          }
        }
      }
      if (!serviceKey) {
        if (!cancelled) {
          setProposeAvailableStaffIds(null)
          setProposeStaffListForService([])
          setIsCheckingProposeStaff(false)
        }
        return
      }
      if (!cancelled) {
        setIsCheckingProposeStaff(true)
      }
      let merged: StaffMember[] = []
      let linkAssignedIds: string[] = []
      let fromLinksForLog: StaffMember[] = []
      let fromStoreCount = 0
      if (resolverClient && bidResolved) {
        const fromStore = await getStaffMembersForService(resolverClient, bidResolved, serviceKey)
        fromStoreCount = fromStore.length
        const linkRes = await resolverClient.from("staff_services").select("*").eq("business_id", bidResolved)
        let linkRows = (linkRes.data ?? []) as Record<string, unknown>[]
        if (linkRows.length === 0) {
          const looseAll = await resolverClient.from("staff_services").select("*")
          const lr = (looseAll.data ?? []) as Record<string, unknown>[]
          linkRows = lr.filter((r) => {
            const rowB = String(r.business_id ?? "").trim()
            return !rowB || rowB === bidResolved
          })
        }
        const matchedLinks = linkRows.filter((r) =>
          publicBookingServiceIdsMatch(coerceServiceIdValue(r.service_id), serviceKey)
        )
        linkAssignedIds = Array.from(
          new Set(
            matchedLinks
              .map((item) => {
                const memberId =
                  typeof item.staff_member_id === "string" && item.staff_member_id.trim()
                    ? item.staff_member_id.trim()
                    : ""
                if (memberId) return memberId
                const legacyStaffId =
                  typeof item.staff_id === "string" && item.staff_id.trim() ? item.staff_id.trim() : ""
                return legacyStaffId
              })
              .filter((id) => id.length > 0)
          )
        )
        if (linkAssignedIds.length > 0) {
          const staffRes = await resolverClient
            .from("staff_members")
            .select("*")
            .in("id", linkAssignedIds)
            .eq("business_id", bidResolved)
            .eq("is_active", true)
          const staffRows = (staffRes.data ?? []) as Record<string, unknown>[]
          fromLinksForLog = staffRows
            .map((staff) => mapProposeStaffDbRow(staff, bidResolved, serviceKey))
            .filter((s): s is StaffMember => Boolean(s))
        }
        merged = mergeStaffMembersById(fromStore, fromLinksForLog)
        console.info("[appointment.change.staff.load]", {
          bookingId: row.id,
          serviceId: serviceKey,
          currentBookingStaffId: row.staffId ?? null,
          assignedStaffIds: linkAssignedIds,
          loadedStaffMembers: fromLinksForLog.map((s) => ({
            id: s.id,
            fullName: s.name,
            isActive: s.isActive,
          })),
          mergedCount: merged.length,
          fromStoreCount,
          fromLinksCount: fromLinksForLog.length,
        })
      }
      if (merged.length === 0 && resolverClient && row.businessSlug?.trim()) {
        const viaPublic = await getServiceStaffForPublicSlug(
          resolverClient,
          row.businessSlug.trim(),
          serviceKey
        )
        merged = viaPublic.staff
      }
      const fallbackAssigned =
        row.staffId?.trim() && row.staffName?.trim()
          ? [
              {
                id: row.staffId.trim(),
                name: row.staffName.trim(),
                email: undefined,
                isActive: true,
                serviceIds: serviceKey ? [serviceKey] : undefined,
                usesDefaultAvailability: true,
              },
            ]
          : []
      const candidates = merged.length > 0 ? merged : fallbackAssigned
      if (!cancelled) {
        setProposeStaffListForService(candidates)
      }
      if (candidates.length === 0) {
        if (!cancelled) {
          setProposeAvailableStaffIds(new Set())
          setIsCheckingProposeStaff(false)
        }
        return
      }
      const client = resolverClient
      const bid = bidResolved
      if (!client || !bid) {
        if (!cancelled) {
          setProposeAvailableStaffIds(new Set(candidates.map((s) => s.id)))
          setIsCheckingProposeStaff(false)
        }
        return
      }
      const svc =
        manualServiceOptions.find((s) => publicBookingServiceIdsMatch(s.id, serviceKey)) ?? null
      const duration = Math.max(1, Math.floor(Number(svc?.durationMinutes ?? 60) || 60))
      const uuidSbForOverlap = unwrapSupabaseBookingAppointmentId(row.id)
      const checks = await Promise.all(
        candidates.map(async (member) => {
          const reasons = new Set<string>()
          const memberLabel = member.name?.trim() || member.email?.trim() || "Osoba bez nazwy"
          if (!member.name?.trim()) {
            reasons.add("missing_full_name")
          }
          if (!member.isActive) {
            reasons.add("inactive")
          }
          if (
            Array.isArray(member.serviceIds) &&
            member.serviceIds.length > 0 &&
            !member.serviceIds.some((sid) => publicBookingServiceIdsMatch(sid, serviceKey))
          ) {
            reasons.add("not_assigned_to_service")
          }
          if (reasons.size === 0) {
            const overlaps = await hasStaffSchedulingIntervalOverlap(
              client,
              bid,
              proposeDate.trim(),
              proposeTime.trim(),
              duration,
              member.id,
              { excludeBookingId: uuidSbForOverlap ?? null }
            )
            if (overlaps) {
              reasons.add("conflicting_booking")
            } else {
              const available = await isStaffAvailableForSlot({
                client,
                businessId: bid,
                staffId: member.id,
                service: {
                  id: serviceKey,
                  durationMinutes: duration,
                  usesDefaultAvailability: member.usesDefaultAvailability,
                },
                date: proposeDate.trim(),
                startTime: proposeTime.trim(),
                excludeBookingId: uuidSbForOverlap ?? null,
              })
              if (!available) {
                let exceptionBlocked = false
                const ctx = await getStaffAvailabilityContextForBusiness(client, bid, member.id)
                const exception = ctx.exceptions.find((x) => x.exceptionDate === proposeDate.trim().slice(0, 10))
                if (exception?.isUnavailable) {
                  exceptionBlocked = true
                } else if (
                  exception?.startTime &&
                  exception?.endTime &&
                  !isTimeInsideRange(exception.startTime, exception.endTime, proposeTime.trim())
                ) {
                  exceptionBlocked = true
                }
                reasons.add(exceptionBlocked ? "unavailable_exception" : "outside_working_hours")
              }
            }
          }
          return {
            id: member.id,
            free: reasons.size === 0 || (reasons.size === 1 && reasons.has("missing_full_name")),
            reasons: Array.from(reasons),
            label: memberLabel,
          }
        })
      )
      if (cancelled) return
      const freeSet = new Set(checks.filter((x) => x.free).map((x) => x.id))
      setProposeAvailableStaffIds(freeSet)
      const reasonsByStaff = checks
        .filter((x) => !x.free)
        .reduce<Record<string, string[]>>((acc, item) => {
          acc[item.id] = item.reasons
          return acc
        }, {})
      const unavailableStaffReasons = checks
        .filter((x) => !x.free)
        .flatMap((item) =>
          item.reasons.map((reason) => {
            const staff = candidates.find((c) => c.id === item.id)
            return {
              staffId: item.id,
              fullName: staff?.name || staff?.email || "Osoba bez nazwy",
              reason,
            }
          })
        )
      const assignedStaffIdsMerged = candidates.map((m) => m.id)
      const activeStaff = candidates.filter((m) => m.isActive).map((m) => ({ id: m.id, name: m.name }))
      const availableStaff = candidates
        .filter((m) => freeSet.has(m.id))
        .map((m) => ({ id: m.id, name: m.name || m.email || "Osoba bez nazwy" }))
      const staffOptions = availableStaff.map((staff) => ({
        value: staff.id,
        label: staff.name || "Osoba bez nazwy",
      }))
      const options =
        availableStaff.length > 1
          ? [{ value: MANUAL_BOOKING_ANY_STAFF, label: t("appointments.manualAnyStaff") }, ...staffOptions]
          : staffOptions
      console.info("[appointment.change.availableStaff]", {
        bookingId: row.id,
        serviceId: serviceKey,
        proposedDate: proposeDate.trim(),
        proposedTime: proposeTime.trim(),
        durationMinutes: duration,
        availableStaff,
        unavailableStaffReasons: reasonsByStaff,
      })
      console.info("[appointment.change.staffOptions]", {
        bookingId: row.id,
        serviceId: serviceKey,
        proposedDate: proposeDate.trim(),
        proposedTime: proposeTime.trim(),
        assignedStaffIds: linkAssignedIds.length > 0 ? linkAssignedIds : assignedStaffIdsMerged,
        activeStaff,
        availableStaff,
        options,
      })
      console.info("[appointment.change.unavailableStaff]", reasonsByStaff)
      console.info("[appointment.change.staff.availability]", {
        proposedDate: proposeDate.trim(),
        proposedTime: proposeTime.trim(),
        durationMinutes: duration,
        availableStaff: availableStaff.map((s) => ({
          id: s.id,
          fullName: s.name,
        })),
        unavailableStaffReasons,
      })
      setIsCheckingProposeStaff(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    proposeForId,
    proposeDate,
    proposeTime,
    proposeResolvedServiceId,
    appointments,
    manualServiceOptions,
    t,
    setProposeAvailableStaffIds,
    setProposeStaffListForService,
    setIsCheckingProposeStaff,
    setProposeResolvedServiceId,
  ])
}

export function useProposeStaffSelectionSyncEffect(args: {
  proposeForId: string | null
  proposeAvailableStaffIds: Set<string> | null
  proposeStaffId: string
  setProposeStaffId: React.Dispatch<React.SetStateAction<string>>
  setProposeValidationError: (msg: string) => void
  t: (key: string) => string
}): void {
  const {
    proposeForId,
    proposeAvailableStaffIds,
    proposeStaffId,
    setProposeStaffId,
    setProposeValidationError,
    t,
  } = args

  React.useEffect(() => {
    if (!proposeForId || !proposeAvailableStaffIds) return
    if (proposeAvailableStaffIds.size === 0) {
      if (proposeStaffId !== MANUAL_BOOKING_ANY_STAFF) {
        queueMicrotask(() => {
          setProposeStaffId(MANUAL_BOOKING_ANY_STAFF)
        })
      }
      return
    }
    if (proposeStaffId === MANUAL_BOOKING_ANY_STAFF) return
    if (proposeAvailableStaffIds.has(proposeStaffId)) return
    const only = Array.from(proposeAvailableStaffIds)[0]
    queueMicrotask(() => {
      setProposeStaffId(
        proposeAvailableStaffIds.size > 1 ? MANUAL_BOOKING_ANY_STAFF : (only ?? MANUAL_BOOKING_ANY_STAFF),
      )
      setProposeValidationError(t("appointments.proposeSelectedStaffNoLongerAvailable"))
    })
  }, [
    proposeForId,
    proposeAvailableStaffIds,
    proposeStaffId,
    setProposeStaffId,
    setProposeValidationError,
    t,
  ])
}
