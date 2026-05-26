"use client"

import * as React from "react"

import { useAppointmentInlineActions } from "@/lib/appointments/use-appointment-inline-actions"
import {
  useProposeAvailableStaffLoadEffect,
  useProposeStaffIdFromStaffByServiceEffect,
  useProposeStaffSelectionSyncEffect,
} from "@/lib/appointments/use-propose-visit-effects"
import { unwrapSupabaseBookingAppointmentId } from "@/lib/bookings/bookings-store"
import { MANUAL_BOOKING_ANY_STAFF } from "@/lib/bookings/manual-booking-staff"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Appointment, Service, StaffMember } from "@/types/domain"

export function useProposeVisitPanel(args: {
  appointments: Appointment[]
  manualServiceOptions: Service[]
  staffByService: Record<string, StaffMember[]>
  setStaffByService: React.Dispatch<React.SetStateAction<Record<string, StaffMember[]>>>
  hasActiveTeamMembers: boolean
  t: (key: string) => string
  language: "en" | "pl"
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
}) {
  const {
    appointments,
    manualServiceOptions,
    staffByService,
    setStaffByService,
    hasActiveTeamMembers,
    t,
    language,
    setActionNotice,
  } = args

  const [proposeForId, setProposeForId] = React.useState<string | null>(null)
  const [proposeDate, setProposeDate] = React.useState("")
  const [proposeTime, setProposeTime] = React.useState("")
  const [proposeValidationError, setProposeValidationError] = React.useState("")
  const [proposeCustomerNote, setProposeCustomerNote] = React.useState("")
  const [proposeStaffId, setProposeStaffId] = React.useState<string>(MANUAL_BOOKING_ANY_STAFF)
  const [proposeAvailableStaffIds, setProposeAvailableStaffIds] = React.useState<Set<string> | null>(null)
  const [proposeResolvedServiceId, setProposeResolvedServiceId] = React.useState("")
  const [proposeStaffListForService, setProposeStaffListForService] = React.useState<StaffMember[] | null>(
    null,
  )
  const [, setIsCheckingProposeStaff] = React.useState(false)
  const [isSavingDirectEdit, setIsSavingDirectEdit] = React.useState(false)
  const [isCancellingVisit, setIsCancellingVisit] = React.useState(false)
  const [confirmCancelVisitForId, setConfirmCancelVisitForId] = React.useState<string | null>(null)

  const proposeTargetAppointment = React.useMemo(
    () => (proposeForId ? appointments.find((a) => a.id === proposeForId) ?? null : null),
    [appointments, proposeForId],
  )
  const proposeServiceId = proposeTargetAppointment?.serviceId?.trim() ?? ""

  useProposeStaffIdFromStaffByServiceEffect({
    proposeForId,
    proposeServiceId,
    staffByService,
    setProposeStaffId,
  })

  const openProposeAnotherTime = React.useCallback(
    (row: Appointment) => {
      const start = new Date(row.startsAt)
      const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`
      const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`
      if (row.status === "cancelled") return
      setConfirmCancelVisitForId(null)
      setProposeValidationError("")
      setProposeForId(row.id)
      setProposeDate(date)
      setProposeTime(time)
      setProposeCustomerNote((row.customerNote ?? row.notes ?? "").trim())
      const svcFromRow = row.serviceId?.trim() ?? ""
      setProposeResolvedServiceId(svcFromRow)
      setProposeStaffListForService(null)
      setProposeAvailableStaffIds(null)
      setProposeStaffId(MANUAL_BOOKING_ANY_STAFF)
      void (async () => {
        const client = getBrowserClient()
        if (!client || !isSupabaseConfigured()) return
        const uuidSb = unwrapSupabaseBookingAppointmentId(row.id)
        if (!uuidSb) return
        const { data: br } = await client
          .from("bookings")
          .select("service_id")
          .eq("id", uuidSb)
          .maybeSingle()
        const sid = typeof br?.service_id === "string" ? br.service_id.trim() : ""
        if (sid) {
          setProposeResolvedServiceId(sid)
        }
      })()
    },
    [],
  )

  useProposeAvailableStaffLoadEffect({
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
  })

  useProposeStaffSelectionSyncEffect({
    proposeForId,
    proposeAvailableStaffIds,
    proposeStaffId,
    setProposeStaffId,
    setProposeValidationError,
    t,
  })

  const appointmentInlineLabels = React.useMemo(
    () => ({
      cannotEditCancelledVisit: t("appointments.cannotEditCancelledVisit"),
      proposeStaffNeedsBookingService: t("appointments.proposeStaffNeedsBookingService"),
      chooseProposalDateTime: t("appointments.chooseProposalDateTime"),
      proposalCouldNotSave: t("appointments.proposalCouldNotSave"),
      manualChooseService: t("appointments.manualChooseService"),
      manualNoStaffForService: t("appointments.manualNoStaffForService"),
      slotNotAvailableForStaff: t("appointments.slotNotAvailableForStaff"),
      changesSaved: t("appointments.changesSaved"),
      cancelVisitCouldNotComplete: t("appointments.cancelVisitCouldNotComplete"),
      visitCancelledNotifySent: t("appointments.visitCancelledNotifySent"),
      visitCancelledNotifyQueued: t("appointments.visitCancelledNotifyQueued"),
      visitCancelledLocal: t("appointments.visitCancelledLocal"),
    }),
    [t],
  )

  const { saveDirectVisitChange, executeCancelVisit, executeRemoveVisit } = useAppointmentInlineActions({
    labels: appointmentInlineLabels,
    language,
    proposeDate,
    proposeTime,
    proposeCustomerNote,
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
    setProposeCustomerNote,
    setProposeResolvedServiceId,
    setProposeStaffListForService,
    setIsCancellingVisit,
    setConfirmCancelVisitForId,
  })

  return {
    proposeForId,
    setProposeForId,
    proposeDate,
    setProposeDate,
    proposeTime,
    setProposeTime,
    proposeCustomerNote,
    setProposeCustomerNote,
    proposeValidationError,
    setProposeValidationError,
    proposeStaffId,
    setProposeStaffId,
    proposeAvailableStaffIds,
    proposeResolvedServiceId,
    setProposeResolvedServiceId,
    proposeStaffListForService,
    setProposeStaffListForService,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
    setConfirmCancelVisitForId,
    openProposeAnotherTime,
    saveDirectVisitChange,
    executeCancelVisit,
    executeRemoveVisit,
  }
}
