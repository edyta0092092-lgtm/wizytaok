"use client"

import * as React from "react"

import { AppointmentListRow } from "@/components/appointments/appointment-list-row"
import { AppointmentsListEmpty } from "@/components/appointments/appointments-list-empty"
import { AppointmentsMobileCard } from "@/components/appointments/appointments-mobile-card"
import { AppointmentsMobilePeriodTabs } from "@/components/appointments/appointments-mobile-period-tabs"
import { APPOINTMENT_ROW_STATUS_ORDER } from "@/lib/appointments/appointment-status-order"
import { isAppointmentVisitLocked } from "@/lib/appointments/appointment-visit-lock"
import {
  selectMobilePeriodRows,
  type AppointmentsMobilePeriodFilter,
} from "@/lib/appointments/appointments-mobile-period"
import type { AppointmentsListWithRowsProps } from "@/components/appointments/appointments-list-with-rows"

const NEEDS_ACTION_STATUS_ORDER = ["completed", "no_show"] as const

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

export type AppointmentsMobileListProps = AppointmentsListWithRowsProps & {
  mobilePeriod: AppointmentsMobilePeriodFilter
  onMobilePeriodChange: (next: AppointmentsMobilePeriodFilter) => void
}

export function AppointmentsMobileList({
  presentation,
  handlers,
  deleteFlow,
  propose,
  bookingPagePath,
  hasActiveSecondaryFilters,
  onClearSecondaryFilters,
  onAddManual,
  mobilePeriod,
  onMobilePeriodChange,
}: AppointmentsMobileListProps) {
  const {
    grouped,
    staffFilter,
    listFilter,
    dayGroupFilter,
    formatWhen,
    reminderPanelLabels,
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
    executeCancelVisit,
    executeRemoveVisit,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
    onCancelVisitPress,
    onCancelVisitDismiss,
  } = propose

  const rows = React.useMemo(
    () => selectMobilePeriodRows(grouped, mobilePeriod),
    [grouped, mobilePeriod],
  )

  const showDateOnCards = mobilePeriod === "week"

  return (
    <div className="flex flex-col gap-4">
      <AppointmentsMobilePeriodTabs value={mobilePeriod} onChange={onMobilePeriodChange} />

      {rows.length === 0 ? (
        <AppointmentsListEmpty
          staffFilter={staffFilter}
          listFilter={listFilter}
          dayGroupFilter={dayGroupFilter}
          hasActiveFilters={hasActiveSecondaryFilters}
          bookingPagePath={bookingPagePath}
          onAddManual={onAddManual}
          onClearFilters={onClearSecondaryFilters}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const { date, time } = formatWhen(row.startsAt)
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

            if (proposeForId === row.id && !isAppointmentVisitLocked(row.status)) {
              return (
                <li key={row.id}>
                  <AppointmentListRow
                    row={row}
                    isLastInSection
                    dateLabel={date}
                    timeLabel={time}
                    reminderSections={[]}
                    remindersAutomatedPolicy={reminderPanelLabels.automatedPolicy}
                    reminderNoRowsMessage=""
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
                    onChangeStatus={(status) => {
                      if (isAppointmentVisitLocked(row.status)) return
                      onChangeStatus(row.id, status)
                    }}
                    editOpen
                    onDeleteRequest={() => onDeleteRequest(row.id)}
                    showDeleteConfirm={effectiveRowId === row.id}
                    onDeleteConfirmDismiss={onDeleteConfirmDismiss}
                    onDeleteConfirm={onDeleteConfirm}
                    isDeletingAppointment={isDeletingAppointment}
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
                    onQuickCancelConfirm={() => executeCancelVisit(row)}
                    onRemoveVisitConfirm={() => executeRemoveVisit(row)}
                    isCancellingVisit={isCancellingVisit}
                  />
                </li>
              )
            }

            return (
              <li key={row.id}>
                <AppointmentsMobileCard
                  row={row}
                  timeLabel={time}
                  dateLabel={date}
                  showDate={showDateOnCards}
                  staffByService={staffByService}
                  onChangeStatus={(status) => {
                    if (isAppointmentVisitLocked(row.status)) return
                    onChangeStatus(row.id, status)
                  }}
                  onCancelPress={() => onCancelVisitPress(row)}
                  onEditVisit={() => onEditVisit(row)}
                  cancelConfirmOpen={confirmCancelVisitForId === row.id}
                  onCancelDismiss={onCancelVisitDismiss}
                  onCancelConfirm={() => executeCancelVisit(row)}
                  isCancellingVisit={isCancellingVisit}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
