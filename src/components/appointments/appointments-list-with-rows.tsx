"use client"

import * as React from "react"

import { AppointmentListRow } from "@/components/appointments/appointment-list-row"
import { AppointmentsGroupedSections } from "@/components/appointments/appointments-grouped-sections"
import { AppointmentsListEmpty } from "@/components/appointments/appointments-list-empty"
import { APPOINTMENT_ROW_STATUS_ORDER } from "@/lib/appointments/appointment-status-order"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import {
  supabaseBookingReminderLine,
  type SupabaseBookingReminderLineLabels,
} from "@/lib/appointments/supabase-booking-reminder-line"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

export type AppointmentsListPresentationBundle = {
  grouped: Record<AppointmentGroupKey, Appointment[]>
  isEmpty: boolean
  staffFilter: StaffAppointmentFilterValue
  listFilter: AppointmentsListFilter
  formatWhen: (startsAt: string) => { date: string; time: string }
  reminderLineLabels: SupabaseBookingReminderLineLabels
  listUiLanguage: "en" | "pl"
}

export type AppointmentsListRowHandlersBundle = {
  staffByService: Record<string, StaffMember[]>
  hasActiveTeamMembers: boolean
  allowAppointmentDelete: boolean
  onStaffChange: (row: Appointment, nextStaffId: string) => void
  onEditVisit: (row: Appointment) => void
  onChangeStatus: (id: string, status: AppointmentStatus) => void
}

export type AppointmentsListDeleteFlowBundle = {
  onRequest: (rowId: string) => void
  effectiveRowId: string | null
  onConfirmDismiss: () => void
  onConfirm: () => void
  isDeleting: boolean
}

export type AppointmentsListProposePanelBundle = {
  proposeForId: string | null
  proposeDate: string
  proposeTime: string
  onProposeDateChange: (iso: string) => void
  onProposeTimeChange: (value: string) => void
  proposeValidationError: string
  proposeStaffId: string
  onProposeStaffIdChange: (id: string) => void
  proposeAvailableStaffIds: Set<string> | null
  proposeResolvedServiceId: string
  proposeStaffListForService: StaffMember[] | null
  onCloseEditPanel: () => void
  saveDirectVisitChange: (row: Appointment) => void
  executeCancelVisit: (row: Appointment) => void
  isSavingDirectEdit: boolean
  isCancellingVisit: boolean
  confirmCancelVisitForId: string | null
  onCancelVisitPress: (row: Appointment) => void
  onCancelVisitDismiss: () => void
}

export type AppointmentsListWithRowsProps = {
  presentation: AppointmentsListPresentationBundle
  handlers: AppointmentsListRowHandlersBundle
  deleteFlow: AppointmentsListDeleteFlowBundle
  propose: AppointmentsListProposePanelBundle
}

export function AppointmentsListWithRows({
  presentation,
  handlers,
  deleteFlow,
  propose,
}: AppointmentsListWithRowsProps) {
  const {
    grouped,
    isEmpty,
    staffFilter,
    listFilter,
    formatWhen,
    reminderLineLabels,
    listUiLanguage,
  } = presentation

  const {
    staffByService,
    hasActiveTeamMembers,
    allowAppointmentDelete,
    onStaffChange,
    onEditVisit,
    onChangeStatus,
  } = handlers

  const {
    onRequest: onDeleteRequest,
    effectiveRowId,
    onConfirmDismiss: onDeleteConfirmDismiss,
    onConfirm: onDeleteConfirm,
    isDeleting: isDeletingAppointment,
  } = deleteFlow

  const {
    proposeForId,
    proposeDate,
    proposeTime,
    onProposeDateChange,
    onProposeTimeChange,
    proposeValidationError,
    proposeStaffId,
    onProposeStaffIdChange,
    proposeAvailableStaffIds,
    proposeResolvedServiceId,
    proposeStaffListForService,
    onCloseEditPanel,
    saveDirectVisitChange,
    executeCancelVisit,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
    onCancelVisitPress,
    onCancelVisitDismiss,
  } = propose

  if (isEmpty) {
    return <AppointmentsListEmpty staffFilter={staffFilter} listFilter={listFilter} />
  }

  return (
    <AppointmentsGroupedSections
      grouped={grouped}
      renderRow={({ row, indexInGroup, groupLength }) => {
        const { date, time } = formatWhen(row.startsAt)
        const reminderLine = supabaseBookingReminderLine(row, reminderLineLabels)
        const saveEditDisabled =
          isSavingDirectEdit ||
          isCancellingVisit ||
          !(proposeResolvedServiceId.trim() || row.serviceId?.trim()) ||
          proposeStaffListForService === null ||
          (proposeAvailableStaffIds != null && proposeAvailableStaffIds.size === 0)
        return (
          <AppointmentListRow
            key={row.id}
            row={row}
            isLastInSection={indexInGroup === groupLength - 1}
            dateLabel={date}
            timeLabel={time}
            reminderLine={reminderLine}
            showNeedsActionReason={listFilter === "needs_action"}
            language={listUiLanguage}
            staffByService={staffByService}
            hasActiveTeamMembers={hasActiveTeamMembers}
            statusOrder={APPOINTMENT_ROW_STATUS_ORDER}
            allowAppointmentDelete={allowAppointmentDelete}
            onStaffChange={(next) => onStaffChange(row, next)}
            onEditVisit={() => onEditVisit(row)}
            onChangeStatus={(s) => onChangeStatus(row.id, s)}
            onDeleteRequest={() => onDeleteRequest(row.id)}
            showDeleteConfirm={effectiveRowId === row.id}
            onDeleteConfirmDismiss={onDeleteConfirmDismiss}
            onDeleteConfirm={onDeleteConfirm}
            isDeletingAppointment={isDeletingAppointment}
            editOpen={proposeForId === row.id}
            proposeDate={proposeDate}
            proposeTime={proposeTime}
            onProposeDateChange={onProposeDateChange}
            onProposeTimeChange={onProposeTimeChange}
            proposeValidationError={proposeValidationError}
            proposeStaffId={proposeStaffId}
            onProposeStaffIdChange={onProposeStaffIdChange}
            proposeAvailableStaffIds={proposeAvailableStaffIds}
            proposeResolvedServiceId={proposeResolvedServiceId}
            proposeStaffListForService={proposeStaffListForService}
            onCloseEditPanel={onCloseEditPanel}
            onSaveEdit={() => saveDirectVisitChange(row)}
            saveEditDisabled={saveEditDisabled}
            isSavingDirectEdit={isSavingDirectEdit}
            confirmCancelVisitOpen={confirmCancelVisitForId === row.id}
            onCancelVisitPress={() => onCancelVisitPress(row)}
            onCancelVisitDismiss={onCancelVisitDismiss}
            onCancelVisitConfirm={() => executeCancelVisit(row)}
            isCancellingVisit={isCancellingVisit}
          />
        )
      }}
    />
  )
}
