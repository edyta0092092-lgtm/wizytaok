"use client"

import * as React from "react"

import type { AppointmentsListWithRowsProps } from "@/components/appointments/appointments-list-with-rows"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import type { SupabaseBookingReminderLineLabels } from "@/lib/appointments/supabase-booking-reminder-line"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

export type AppointmentsListWithRowsBundlesParams = {
  grouped: Record<AppointmentGroupKey, Appointment[]>
  filteredCount: number
  staffFilter: StaffAppointmentFilterValue
  listFilter: AppointmentsListFilter
  formatWhen: (startsAt: string) => { date: string; time: string }
  reminderLineLabels: SupabaseBookingReminderLineLabels
  listUiLanguage: "en" | "pl"
  staffByService: Record<string, StaffMember[]>
  hasActiveTeamMembers: boolean
  allowAppointmentDelete: boolean
  onStaffChange: (row: Appointment, nextStaffId: string) => void
  onEditVisit: (row: Appointment) => void
  onChangeStatus: (id: string, status: AppointmentStatus) => void
  setConfirmDeleteAppointmentId: (id: string | null) => void
  effectiveConfirmDeleteRowId: string | null
  onDeleteConfirm: () => void
  isDeletingAppointment: boolean
  proposeForId: string | null
  proposeDate: string
  proposeTime: string
  setProposeDate: (v: string) => void
  setProposeTime: (v: string) => void
  proposeValidationError: string
  setProposeValidationError: (v: string) => void
  proposeStaffId: string
  setProposeStaffId: (v: string) => void
  proposeAvailableStaffIds: Set<string> | null
  proposeResolvedServiceId: string
  proposeStaffListForService: StaffMember[] | null
  setProposeForId: (v: string | null) => void
  setProposeResolvedServiceId: (v: string) => void
  setProposeStaffListForService: (v: StaffMember[] | null) => void
  setConfirmCancelVisitForId: (v: string | null) => void
  saveDirectVisitChange: (row: Appointment) => void
  executeCancelVisit: (row: Appointment) => void
  isSavingDirectEdit: boolean
  isCancellingVisit: boolean
  confirmCancelVisitForId: string | null
}

export function useAppointmentsListWithRowsBundles({
  grouped,
  filteredCount,
  staffFilter,
  listFilter,
  formatWhen,
  reminderLineLabels,
  listUiLanguage,
  staffByService,
  hasActiveTeamMembers,
  allowAppointmentDelete,
  onStaffChange,
  onEditVisit,
  onChangeStatus,
  setConfirmDeleteAppointmentId,
  effectiveConfirmDeleteRowId,
  onDeleteConfirm,
  isDeletingAppointment,
  proposeForId,
  proposeDate,
  proposeTime,
  setProposeDate,
  setProposeTime,
  proposeValidationError,
  setProposeValidationError,
  proposeStaffId,
  setProposeStaffId,
  proposeAvailableStaffIds,
  proposeResolvedServiceId,
  proposeStaffListForService,
  setProposeForId,
  setProposeResolvedServiceId,
  setProposeStaffListForService,
  setConfirmCancelVisitForId,
  saveDirectVisitChange,
  executeCancelVisit,
  isSavingDirectEdit,
  isCancellingVisit,
  confirmCancelVisitForId,
}: AppointmentsListWithRowsBundlesParams): AppointmentsListWithRowsProps {
  return React.useMemo(
    () => ({
      presentation: {
        grouped,
        isEmpty: filteredCount === 0,
        staffFilter,
        listFilter,
        formatWhen,
        reminderLineLabels,
        listUiLanguage,
      },
      handlers: {
        staffByService,
        hasActiveTeamMembers,
        allowAppointmentDelete,
        onStaffChange,
        onEditVisit,
        onChangeStatus,
      },
      deleteFlow: {
        onRequest: setConfirmDeleteAppointmentId,
        effectiveRowId: effectiveConfirmDeleteRowId,
        onConfirmDismiss: () => setConfirmDeleteAppointmentId(null),
        onConfirm: onDeleteConfirm,
        isDeleting: isDeletingAppointment,
      },
      propose: {
        proposeForId,
        proposeDate,
        proposeTime,
        onProposeDateChange: (iso: string) => {
          setProposeDate(iso)
          setProposeValidationError("")
        },
        onProposeTimeChange: (value: string) => {
          setProposeTime(value)
          setProposeValidationError("")
        },
        proposeValidationError,
        proposeStaffId,
        onProposeStaffIdChange: (id: string) => {
          setProposeStaffId(id)
          setProposeValidationError("")
        },
        proposeAvailableStaffIds,
        proposeResolvedServiceId,
        proposeStaffListForService,
        onCloseEditPanel: () => {
          setProposeForId(null)
          setProposeValidationError("")
          setProposeResolvedServiceId("")
          setProposeStaffListForService(null)
          setConfirmCancelVisitForId(null)
        },
        saveDirectVisitChange,
        executeCancelVisit,
        isSavingDirectEdit,
        isCancellingVisit,
        confirmCancelVisitForId,
        onCancelVisitPress: (row: Appointment) => {
          setConfirmCancelVisitForId(row.id)
          setProposeValidationError("")
        },
        onCancelVisitDismiss: () => setConfirmCancelVisitForId(null),
      },
    }),
    [
      grouped,
      filteredCount,
      staffFilter,
      listFilter,
      formatWhen,
      reminderLineLabels,
      listUiLanguage,
      staffByService,
      hasActiveTeamMembers,
      allowAppointmentDelete,
      onStaffChange,
      onEditVisit,
      onChangeStatus,
      setConfirmDeleteAppointmentId,
      effectiveConfirmDeleteRowId,
      onDeleteConfirm,
      isDeletingAppointment,
      proposeForId,
      proposeDate,
      proposeTime,
      setProposeDate,
      setProposeTime,
      setProposeValidationError,
      proposeValidationError,
      proposeStaffId,
      setProposeStaffId,
      proposeAvailableStaffIds,
      proposeResolvedServiceId,
      proposeStaffListForService,
      setProposeForId,
      setProposeResolvedServiceId,
      setProposeStaffListForService,
      setConfirmCancelVisitForId,
      saveDirectVisitChange,
      executeCancelVisit,
      isSavingDirectEdit,
      isCancellingVisit,
      confirmCancelVisitForId,
    ],
  )
}
