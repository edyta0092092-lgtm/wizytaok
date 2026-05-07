"use client"

import * as React from "react"

import { AppointmentListRow } from "@/components/appointments/appointment-list-row"
import { AppointmentsGroupedSections } from "@/components/appointments/appointments-grouped-sections"
import { AppointmentsListEmpty } from "@/components/appointments/appointments-list-empty"
import { APPOINTMENT_ROW_STATUS_ORDER } from "@/lib/appointments/appointment-status-order"
import type { AppointmentsListFilter } from "@/lib/appointments/appointments-list-filters"
import type { AppointmentGroupKey } from "@/lib/appointments/appointments-grouping"
import { getBookingReminderStatus, type ReminderUiStatus } from "@/lib/appointments/booking-reminder-status"
import type { SupabaseBookingReminderLineLabels } from "@/lib/appointments/supabase-booking-reminder-line"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Tables } from "@/types/database"
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
    formatWhen,
    reminderLineLabels: _reminderLineLabels,
    listUiLanguage,
  } = presentation

  const [reminderLogsByBookingId, setReminderLogsByBookingId] = React.useState<
    Record<string, Array<Pick<Tables<"notification_logs">, "status" | "type" | "channel">>>
  >({})

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isSupabaseConfigured()) return
      const client = getBrowserClient()
      if (!client) return
      const bookingIds = Object.values(grouped)
        .flat()
        .filter((row) => row.id.startsWith("sb-"))
        .map((row) => row.id.slice(3))
      if (bookingIds.length === 0) {
        if (!cancelled) setReminderLogsByBookingId({})
        return
      }
      const businessId = await getCurrentBusinessProfileIdForClient(client)
      if (!businessId) return
      const { data, error } = await client
        .from("notification_logs")
        .select("booking_id,status,type,channel,created_at")
        .eq("business_id", businessId)
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false })
      if (error) return
      if (cancelled) return
      const groupedLogs: Record<
        string,
        Array<Pick<Tables<"notification_logs">, "status" | "type" | "channel">>
      > = {}
      for (const row of data ?? []) {
        const bookingId = String(row.booking_id ?? "")
        if (!bookingId) continue
        if (!groupedLogs[bookingId]) groupedLogs[bookingId] = []
        groupedLogs[bookingId]!.push({
          status: row.status,
          type: row.type,
          channel: row.channel,
        })
      }
      setReminderLogsByBookingId(groupedLogs)
    })()
    return () => {
      cancelled = true
    }
  }, [grouped])

  const statusLabel = React.useCallback(
    (status: ReminderUiStatus): string => {
      if (status === "failed") return "nieudane"
      if (status === "sent") return "wysłane"
      if (status === "partial") return "częściowo wysłane"
      if (status === "unsent") return "niewysłane"
      if (status === "disabled") return "wyłączone"
      return "zaplanowane"
    },
    []
  )

  void _reminderLineLabels

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
    executeRemoveVisit,
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
        const reminderLines: string[] = []
        if (row.id.startsWith("sb-")) {
          const bookingId = row.id.slice(3)
          const resolved = getBookingReminderStatus(
            bookingId,
            row,
            reminderLogsByBookingId[bookingId] ?? [],
            true
          )
          if (resolved.overall === "disabled") {
            reminderLines.push("Przypomnienia wyłączone")
          } else {
            for (const line of resolved.lines) {
              if (line.kind === "reminder24h") {
                reminderLines.push(`Przypomnienie 24h: ${statusLabel(line.status)}`)
              } else {
                reminderLines.push(`Przypomnienie przed wizytą: ${statusLabel(line.status)}`)
              }
            }
          }
        }
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
            reminderLines={reminderLines}
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
            onCancelVisitConfirm={onCancelVisitDismiss}
            onRemoveVisitConfirm={() => executeRemoveVisit(row)}
            isCancellingVisit={isCancellingVisit}
          />
        )
      }}
    />
  )
}
