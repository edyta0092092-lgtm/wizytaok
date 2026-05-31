"use client"

import * as React from "react"

import { AppointmentListRow } from "@/components/appointments/appointment-list-row"
import { AppointmentsGroupedSections } from "@/components/appointments/appointments-grouped-sections"
import { AppointmentsListEmpty } from "@/components/appointments/appointments-list-empty"
import { APPOINTMENT_ROW_STATUS_ORDER } from "@/lib/appointments/appointment-status-order"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentsDayGroupFilter, AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import {
  buildAppointmentReminderSections,
  groupAppointmentReminderRowsByBookingId,
  type AppointmentReminderPanelLabels,
  type AppointmentReminderQueueRow,
  type AppointmentReminderSection,
} from "@/lib/appointments/appointment-reminder-panel-display"
import { resyncAppointmentRemindersQueue } from "@/lib/messages/resync-appointment-reminders-queue"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { StaffAppointmentFilterValue } from "@/lib/staff/staff-display"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

const NEEDS_ACTION_STATUS_ORDER: AppointmentStatus[] = ["completed", "no_show"]

function formatEditDateTime(startsAt: string): { date: string; time: string } {
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return { date: "", time: "" }
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(
      2,
      "0",
    )}`,
  }
}

export type AppointmentsListPresentationBundle = {
  grouped: Record<AppointmentGroupKey, Appointment[]>
  isEmpty: boolean
  staffFilter: StaffAppointmentFilterValue
  listFilter: AppointmentsListFilter
  dayGroupFilter: AppointmentsDayGroupFilter
  formatWhen: (startsAt: string) => { date: string; time: string }
  reminderPanelLabels: AppointmentReminderPanelLabels
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
  proposeCustomerNote: string
  onProposeDateChange: (iso: string) => void
  onProposeTimeChange: (value: string) => void
  onProposeCustomerNoteChange: (value: string) => void
  proposeValidationError: string
  proposeStaffId: string
  onProposeStaffIdChange: (id: string) => void
  proposeAvailableStaffIds: Set<string> | null
  proposeResolvedServiceId: string
  proposeStaffListForService: StaffMember[] | null
  onCloseEditPanel: () => void
  saveDirectVisitChange: (row: Appointment) => void
  executeCancelVisit: (row: Appointment) => void
  executeRemoveVisit: (row: Appointment) => void
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
    dayGroupFilter,
    formatWhen,
    reminderPanelLabels,
    listUiLanguage,
  } = presentation

  const [reminderSectionsByBookingId, setReminderSectionsByBookingId] = React.useState<
    Record<string, AppointmentReminderSection[]>
  >({})
  const [reminderRowsLoaded, setReminderRowsLoaded] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setReminderRowsLoaded(false)
    })
    void (async () => {
      if (!isSupabaseConfigured()) {
        if (!cancelled) {
          setReminderSectionsByBookingId({})
          setReminderRowsLoaded(true)
        }
        return
      }
      const client = getBrowserClient()
      if (!client) return
      const bookingIds = Object.values(grouped)
        .flat()
        .filter((row) => row.id.startsWith("sb-"))
        .map((row) => row.id.slice(3))
      if (bookingIds.length === 0) {
        if (!cancelled) {
          setReminderSectionsByBookingId({})
          setReminderRowsLoaded(true)
        }
        return
      }
      const businessId = await getCurrentBusinessProfileIdForClient(client)
      if (!businessId) return
      await resyncAppointmentRemindersQueue(client, businessId)
      const { data, error } = await client
        .from("appointment_reminders")
        .select("appointment_id,channel,reminder_kind,status")
        .eq("business_id", businessId)
        .in("appointment_id", bookingIds)
      if (cancelled) return
      if (error) {
        setReminderSectionsByBookingId({})
        setReminderRowsLoaded(true)
        return
      }
      const rows = (data ?? []) as AppointmentReminderQueueRow[]
      const groupedRows = groupAppointmentReminderRowsByBookingId(rows)
      const sectionsByBooking: Record<string, AppointmentReminderSection[]> = {}
      for (const bookingId of bookingIds) {
        const sections = buildAppointmentReminderSections(
          groupedRows[bookingId] ?? [],
          reminderPanelLabels,
        )
        if (sections.length > 0) {
          sectionsByBooking[bookingId] = sections
        }
      }
      setReminderSectionsByBookingId(sectionsByBooking)
      setReminderRowsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [grouped, reminderPanelLabels])

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
    proposeCustomerNote,
    onProposeDateChange,
    onProposeTimeChange,
    onProposeCustomerNoteChange,
    proposeValidationError,
    proposeStaffId,
    onProposeStaffIdChange,
    proposeAvailableStaffIds,
    proposeResolvedServiceId,
    proposeStaffListForService,
    onCloseEditPanel,
    saveDirectVisitChange,
    executeRemoveVisit,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
    onCancelVisitPress,
    onCancelVisitDismiss,
  } = propose

  if (isEmpty) {
    return <AppointmentsListEmpty staffFilter={staffFilter} listFilter={listFilter} dayGroupFilter={dayGroupFilter} />
  }

  return (
    <AppointmentsGroupedSections
      grouped={grouped}
      renderRow={({ row, indexInGroup, groupLength }) => {
        const { date, time } = formatWhen(row.startsAt)
        const reminderSections =
          row.id.startsWith("sb-") ? reminderSectionsByBookingId[row.id.slice(3)] ?? [] : []
        const currentEditDateTime = formatEditDateTime(row.startsAt)
        const scheduleChanged =
          proposeDate.trim() !== currentEditDateTime.date ||
          proposeTime.trim() !== currentEditDateTime.time
        const saveEditDisabled =
          isSavingDirectEdit ||
          isCancellingVisit ||
          (scheduleChanged &&
            (!(proposeResolvedServiceId.trim() || row.serviceId?.trim()) ||
              proposeStaffListForService === null ||
              (proposeAvailableStaffIds != null && proposeAvailableStaffIds.size === 0)))
        return (
          <AppointmentListRow
            key={row.id}
            row={row}
            isLastInSection={indexInGroup === groupLength - 1}
            dateLabel={date}
            timeLabel={time}
            reminderSections={reminderSections}
            remindersAutomatedPolicy={reminderPanelLabels.automatedPolicy}
            reminderNoRowsMessage={
              reminderRowsLoaded ? reminderPanelLabels.noReminders : ""
            }
            showNeedsActionReason={listFilter === "needs_action"}
            language={listUiLanguage}
            staffByService={staffByService}
            hasActiveTeamMembers={hasActiveTeamMembers}
            statusOrder={
              listFilter === "needs_action"
                ? NEEDS_ACTION_STATUS_ORDER
                : APPOINTMENT_ROW_STATUS_ORDER
            }
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
            proposeCustomerNote={proposeCustomerNote}
            onProposeDateChange={onProposeDateChange}
            onProposeTimeChange={onProposeTimeChange}
            onProposeCustomerNoteChange={onProposeCustomerNoteChange}
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
            onCancelVisitConfirm={onCancelVisitDismiss}
            onRemoveVisitConfirm={() => executeRemoveVisit(row)}
            isCancellingVisit={isCancellingVisit}
          />
        )
      }}
    />
  )
}
