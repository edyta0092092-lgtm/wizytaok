"use client"

import * as React from "react"

import { patchAppointmentRowStaffSupabase } from "@/lib/appointments/patch-appointment-row-staff-supabase"
import { useApplyManualAppointmentStatus } from "@/lib/appointments/use-apply-manual-appointment-status"
import { useAppointmentReminderLineLabels } from "@/lib/appointments/use-appointment-reminder-line-labels"
import {
  useAppointmentsListWithRowsBundles,
  type AppointmentsListWithRowsBundlesParams,
} from "@/lib/appointments/use-appointments-list-with-rows-bundles"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { Appointment, StaffMember } from "@/types/domain"

export type UseAppointmentsPageListControllerParams = {
  t: (key: string) => string
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
  grouped: Record<AppointmentGroupKey, Appointment[]>
  filteredCount: number
  staffFilter: StaffAppointmentFilterValue
  listFilter: AppointmentsListFilter
  formatWhen: (startsAt: string) => { date: string; time: string }
  listUiLanguage: "en" | "pl"
  staffByService: Record<string, StaffMember[]>
  hasActiveTeamMembers: boolean
  allowAppointmentDelete: boolean
} & Pick<
  AppointmentsListWithRowsBundlesParams,
  | "setConfirmDeleteAppointmentId"
  | "effectiveConfirmDeleteRowId"
  | "onDeleteConfirm"
  | "isDeletingAppointment"
  | "proposeForId"
  | "proposeDate"
  | "proposeTime"
  | "proposeCustomerNote"
  | "setProposeDate"
  | "setProposeTime"
  | "setProposeCustomerNote"
  | "proposeValidationError"
  | "setProposeValidationError"
  | "proposeStaffId"
  | "setProposeStaffId"
  | "proposeAvailableStaffIds"
  | "proposeResolvedServiceId"
  | "proposeStaffListForService"
  | "setProposeForId"
  | "setProposeResolvedServiceId"
  | "setProposeStaffListForService"
  | "setConfirmCancelVisitForId"
  | "saveDirectVisitChange"
  | "executeCancelVisit"
  | "executeRemoveVisit"
  | "isSavingDirectEdit"
  | "isCancellingVisit"
  | "confirmCancelVisitForId"
  | "onEditVisit"
>

export function useAppointmentsPageListController(args: UseAppointmentsPageListControllerParams) {
  const {
    t,
    setActionNotice,
    grouped,
    filteredCount,
    staffFilter,
    listFilter,
    formatWhen,
    listUiLanguage,
    staffByService,
    hasActiveTeamMembers,
    allowAppointmentDelete,
    setConfirmDeleteAppointmentId,
    effectiveConfirmDeleteRowId,
    onDeleteConfirm,
    isDeletingAppointment,
    proposeForId,
    proposeDate,
    proposeTime,
    proposeCustomerNote,
    setProposeDate,
    setProposeTime,
    setProposeCustomerNote,
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
    executeRemoveVisit,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
    onEditVisit,
  } = args

  const { panel: reminderPanelLabels } = useAppointmentReminderLineLabels(t, listUiLanguage)
  const onChangeStatus = useApplyManualAppointmentStatus(t, setActionNotice)

  const onStaffChange = React.useCallback(
    (row: Appointment, nextStaffId: string) => {
      void patchAppointmentRowStaffSupabase({ row, nextStaffId, staffByService })
    },
    [staffByService],
  )

  return useAppointmentsListWithRowsBundles({
    grouped,
    filteredCount,
    staffFilter,
    listFilter,
    formatWhen,
    reminderPanelLabels,
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
    proposeCustomerNote,
    setProposeDate,
    setProposeTime,
    setProposeCustomerNote,
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
    executeRemoveVisit,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
  })
}
