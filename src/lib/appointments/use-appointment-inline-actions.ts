"use client"

import * as React from "react"

import { updateAppointmentStatus } from "@/lib/appointments/appointments-store"
import { cancelAppointmentFromRemove } from "@/lib/appointments/cancel-appointment-from-remove"
import { unwrapManualAppointmentId, updateManualAppointment } from "@/lib/appointments/manual-appointments"
import { fetchCancelBookingByCompany } from "@/lib/bookings/cancel-booking-by-company-client"
import {
  applyPublicBookingPatchToSupabase,
  unwrapSupabaseBookingAppointmentId,
} from "@/lib/bookings/bookings-store"
import {
  MANUAL_BOOKING_ANY_STAFF,
  resolveManualBookingStaffSelection,
} from "@/lib/bookings/manual-booking-staff"
import {
  updatePublicBooking,
  unwrapPublicAppointmentId,
} from "@/lib/bookings/public-bookings"
import {
  hasStaffSchedulingIntervalOverlap,
  isAppointmentSlotTakenByOtherBooking,
} from "@/lib/bookings/slot-availability"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import {
  getStaffMembersForService,
  getServiceStaffForPublicSlug,
  publicBookingServiceIdsMatch,
} from "@/lib/staff/staff-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Appointment, Service, StaffMember } from "@/types/domain"

export type AppointmentInlineActionLabels = {
  cannotEditCancelledVisit: string
  proposeStaffNeedsBookingService: string
  chooseProposalDateTime: string
  proposalCouldNotSave: string
  manualChooseService: string
  manualNoStaffForService: string
  slotNotAvailableForStaff: string
  changesSaved: string
  cancelVisitCouldNotComplete: string
  visitCancelledNotifySent: string
  visitCancelledNotifyQueued: string
  visitCancelledLocal: string
}

export function useAppointmentInlineActions(args: {
  labels: AppointmentInlineActionLabels
  language: "en" | "pl"
  proposeDate: string
  proposeTime: string
  proposeResolvedServiceId: string
  proposeStaffId: string
  proposeStaffListForService: StaffMember[] | null
  manualServiceOptions: Service[]
  staffByService: Record<string, StaffMember[]>
  setStaffByService: React.Dispatch<React.SetStateAction<Record<string, StaffMember[]>>>
  hasActiveTeamMembers: boolean
  setProposeValidationError: React.Dispatch<React.SetStateAction<string>>
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
  setIsSavingDirectEdit: React.Dispatch<React.SetStateAction<boolean>>
  setProposeForId: React.Dispatch<React.SetStateAction<string | null>>
  setProposeDate: React.Dispatch<React.SetStateAction<string>>
  setProposeTime: React.Dispatch<React.SetStateAction<string>>
  setProposeResolvedServiceId: React.Dispatch<React.SetStateAction<string>>
  setProposeStaffListForService: React.Dispatch<React.SetStateAction<StaffMember[] | null>>
  setIsCancellingVisit: React.Dispatch<React.SetStateAction<boolean>>
  setConfirmCancelVisitForId: React.Dispatch<React.SetStateAction<string | null>>
}) {
  const {
    labels,
    language,
    proposeDate,
    proposeTime,
    proposeResolvedServiceId,
    proposeStaffId,
    proposeStaffListForService,
    manualServiceOptions,
    staffByService,
    setStaffByService,
    hasActiveTeamMembers,
    setProposeValidationError,
    setActionNotice,
    setIsSavingDirectEdit,
    setProposeForId,
    setProposeDate,
    setProposeTime,
    setProposeResolvedServiceId,
    setProposeStaffListForService,
    setIsCancellingVisit,
    setConfirmCancelVisitForId,
  } = args

  const saveDirectVisitChange = React.useCallback(
    (row: Appointment) => {
      if (row.status === "cancelled") {
        setProposeValidationError(labels.cannotEditCancelledVisit)
        return
      }
      const date = proposeDate.trim()
      const time = proposeTime.trim()
      const canonicalServiceId =
        proposeResolvedServiceId.trim() || row.serviceId?.trim() || ""
      const slotMsg = () => setProposeValidationError(labels.slotNotAvailableForStaff)
      if (!canonicalServiceId) {
        setProposeValidationError(labels.proposeStaffNeedsBookingService)
        return
      }
      if (!date || !time) {
        setProposeValidationError(labels.chooseProposalDateTime)
        return
      }
      const uuidSb = unwrapSupabaseBookingAppointmentId(row.id)
      const rawPb = unwrapPublicAppointmentId(row.id)
      const rawMa = unwrapManualAppointmentId(row.id)
      if (!uuidSb && !rawPb && !rawMa) {
        setProposeValidationError("")
        setActionNotice(labels.proposalCouldNotSave)
        return
      }

      setProposeValidationError("")
      setIsSavingDirectEdit(true)

      void (async () => {
        try {
          const serviceForProposal =
            manualServiceOptions.find((s) => publicBookingServiceIdsMatch(s.id, canonicalServiceId)) ??
            null

          let resolvedStaffId: string | undefined
          let resolvedStaffName: string | undefined

          const resolveStaff = async (): Promise<boolean> => {
            if (!canonicalServiceId) return true
            const svc = serviceForProposal
            if (!svc) {
              setProposeValidationError(labels.manualChooseService)
              return false
            }
            const resolverClient = getBrowserClient()
            let bidResolved =
              resolverClient && isSupabaseConfigured()
                ? await getCurrentBusinessProfileIdForClient(resolverClient)
                : null
            if (!bidResolved && resolverClient && uuidSb) {
              const { data: bookingRow } = await resolverClient
                .from("bookings")
                .select("business_id")
                .eq("id", uuidSb)
                .maybeSingle()
              const b = typeof bookingRow?.business_id === "string" ? bookingRow.business_id.trim() : ""
              if (b) bidResolved = b
            }
            let candidates: StaffMember[] | undefined =
              proposeStaffListForService && proposeStaffListForService.length > 0
                ? proposeStaffListForService
                : staffByService[canonicalServiceId]
            if (resolverClient && bidResolved && (candidates === undefined || candidates.length === 0)) {
              candidates = await getStaffMembersForService(resolverClient, bidResolved, canonicalServiceId)
              setStaffByService((prev) => ({ ...prev, [canonicalServiceId]: candidates ?? [] }))
            }
            if (
              resolverClient &&
              (!candidates || candidates.length === 0) &&
              row.businessSlug?.trim()
            ) {
              const viaPublic = await getServiceStaffForPublicSlug(
                resolverClient,
                row.businessSlug.trim(),
                canonicalServiceId
              )
              candidates = viaPublic.staff
              if (viaPublic.staff.length > 0) {
                setStaffByService((prev) => ({ ...prev, [canonicalServiceId]: viaPublic.staff }))
              }
            }
            candidates = candidates ?? []
            if (hasActiveTeamMembers && candidates.length === 0) {
              setProposeValidationError(labels.manualNoStaffForService)
              return false
            }
            if (resolverClient && bidResolved) {
              const resolution = await resolveManualBookingStaffSelection({
                client: resolverClient,
                businessId: bidResolved,
                service: svc,
                appointmentDate: date,
                appointmentTime: time,
                staffChoice: proposeStaffId.trim() || MANUAL_BOOKING_ANY_STAFF,
                candidates,
                hasActiveTeam: hasActiveTeamMembers && candidates.length > 0,
                excludeBookingId: uuidSb ?? null,
                availabilityFeedback: "proposal",
              })
              if (!resolution.ok) {
                slotMsg()
                return false
              }
              resolvedStaffId = resolution.staffId ?? undefined
              resolvedStaffName = resolution.staffName ?? undefined
              return true
            }
            const sorted = [...candidates].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
            )
            if (sorted.length === 1) {
              resolvedStaffId = sorted[0]!.id
              resolvedStaffName = sorted[0]!.name
              return true
            }
            const choice = proposeStaffId.trim()
            if (!choice || choice === MANUAL_BOOKING_ANY_STAFF) {
              resolvedStaffId = sorted[0]?.id
              resolvedStaffName = sorted[0]?.name
              return true
            }
            const picked = sorted.find((m) => m.id === choice)
            if (!picked) {
              slotMsg()
              return false
            }
            resolvedStaffId = picked.id
            resolvedStaffName = picked.name
            return true
          }

          if (!(await resolveStaff())) {
            return
          }

          if (uuidSb) {
            const client = getBrowserClient()
            if (!client) {
              setActionNotice(labels.proposalCouldNotSave)
              return
            }
            const bid = await getCurrentBusinessProfileIdForClient(client)
            if (!bid) {
              setActionNotice(labels.proposalCouldNotSave)
              return
            }
            const staffScope =
              typeof resolvedStaffId === "string" && resolvedStaffId.trim().length > 0
                ? resolvedStaffId.trim()
                : null
            if (staffScope) {
              const dur = Math.max(1, Math.floor(Number(serviceForProposal?.durationMinutes ?? 0) || 60))
              const overlaps = await hasStaffSchedulingIntervalOverlap(
                client,
                bid,
                date,
                time,
                dur,
                staffScope,
                { excludeBookingId: uuidSb },
              )
              if (overlaps) {
                slotMsg()
                return
              }
            } else if (
              await isAppointmentSlotTakenByOtherBooking(client, bid, date, time, {
                excludeBookingId: uuidSb,
                staffScope: null,
              })
            ) {
              slotMsg()
              return
            }
            const r = await applyPublicBookingPatchToSupabase(client, bid, uuidSb, {
              date: date.trim(),
              time: time.trim(),
              staffId: resolvedStaffId,
              staffName: resolvedStaffName,
              lastUpdatedBy: "business",
              lastStatusChangeSource: "manual",
              updatedAt: new Date().toISOString(),
            })
            if (!r.ok) {
              setActionNotice(labels.proposalCouldNotSave)
              return
            }
            setProposeForId(null)
            setProposeDate("")
            setProposeTime("")
            setProposeResolvedServiceId("")
            setProposeStaffListForService(null)
            setActionNotice(labels.changesSaved)
            return
          }

          const updatedAt = new Date().toISOString()
          let saved = false
          if (rawPb) {
            saved = updatePublicBooking(rawPb, {
              date: date.trim(),
              time: time.trim(),
              staffId: resolvedStaffId,
              staffName: resolvedStaffName,
              lastUpdatedBy: "business",
              updatedAt,
              lastStatusChangeSource: "manual",
            })
          } else if (rawMa) {
            saved = updateManualAppointment(rawMa, {
              date: date.trim(),
              time: time.trim(),
              staffId: resolvedStaffId,
              staffName: resolvedStaffName,
              lastUpdatedBy: "business",
              updatedAt,
              lastStatusChangeSource: "manual",
            })
          }
          if (!saved) {
            setActionNotice(labels.proposalCouldNotSave)
            return
          }
          setProposeForId(null)
          setProposeDate("")
          setProposeTime("")
          setProposeResolvedServiceId("")
          setProposeStaffListForService(null)
          setActionNotice(labels.changesSaved)
        } finally {
          setIsSavingDirectEdit(false)
        }
      })()
    },
    [
      labels,
      proposeDate,
      proposeTime,
      proposeResolvedServiceId,
      proposeStaffId,
      proposeStaffListForService,
      manualServiceOptions,
      staffByService,
      setStaffByService,
      hasActiveTeamMembers,
      setProposeValidationError,
      setActionNotice,
      setIsSavingDirectEdit,
      setProposeForId,
      setProposeDate,
      setProposeTime,
      setProposeResolvedServiceId,
      setProposeStaffListForService,
    ],
  )

  const executeCancelVisit = React.useCallback(
    (row: Appointment) => {
      void (async () => {
        const uuidSb = unwrapSupabaseBookingAppointmentId(row.id)
        setIsCancellingVisit(true)
        try {
          if (uuidSb) {
            const cancelRes = await fetchCancelBookingByCompany(
              row.id,
              language === "en" ? "en" : "pl",
              true,
            )
            if (!cancelRes.ok) {
              setActionNotice(labels.cancelVisitCouldNotComplete)
              return
            }
            window.dispatchEvent(new Event("pw-bookings"))
            setProposeForId(null)
            setProposeValidationError("")
            setProposeResolvedServiceId("")
            setProposeStaffListForService(null)
            setConfirmCancelVisitForId(null)
            setActionNotice(
              cancelRes.notice === "sent"
                ? labels.visitCancelledNotifySent
                : labels.visitCancelledNotifyQueued,
            )
            return
          }
          const ok = await updateAppointmentStatus(row.id, "cancelled", {
            lastUpdatedBy: "business",
            lastStatusChangeSource: "manual",
          })
          if (!ok) {
            setActionNotice(labels.cancelVisitCouldNotComplete)
            return
          }
          setProposeForId(null)
          setProposeValidationError("")
          setProposeResolvedServiceId("")
          setProposeStaffListForService(null)
          setConfirmCancelVisitForId(null)
          setActionNotice(labels.visitCancelledLocal)
        } finally {
          setIsCancellingVisit(false)
        }
      })()
    },
    [
      language,
      labels,
      setActionNotice,
      setConfirmCancelVisitForId,
      setIsCancellingVisit,
      setProposeForId,
      setProposeResolvedServiceId,
      setProposeStaffListForService,
      setProposeValidationError,
    ],
  )

  const handleCancelVisitFromEditForm = React.useCallback(
    (row: Appointment) => {
      void (async () => {
        setIsCancellingVisit(true)
        try {
          const result = await cancelAppointmentFromRemove(row.id, language, true)
          console.info("[appointment.cancel.update.result]", {
            bookingId: row?.id,
            data: result.data ?? null,
            error: result.error ?? null,
          })
          if (!result.ok) {
            setActionNotice(labels.cancelVisitCouldNotComplete)
            return
          }
          window.dispatchEvent(new Event("pw-bookings"))
          setProposeForId(null)
          setProposeValidationError("")
          setProposeResolvedServiceId("")
          setProposeStaffListForService(null)
          setConfirmCancelVisitForId(null)
          setActionNotice(labels.visitCancelledLocal)
        } finally {
          setIsCancellingVisit(false)
        }
      })()
    },
    [
      language,
      labels.cancelVisitCouldNotComplete,
      labels.visitCancelledLocal,
      setActionNotice,
      setConfirmCancelVisitForId,
      setIsCancellingVisit,
      setProposeForId,
      setProposeResolvedServiceId,
      setProposeStaffListForService,
      setProposeValidationError,
    ],
  )

  const executeRemoveVisit = handleCancelVisitFromEditForm

  return { saveDirectVisitChange, executeCancelVisit, executeRemoveVisit, handleCancelVisitFromEditForm }
}
