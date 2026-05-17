"use client"

import * as React from "react"
import Link from "next/link"

import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions"
import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { StatusBadge } from "@/components/shared/status-badge"
import { AppDatePicker } from "@/components/ui/app-date-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getBookingSourceLabel } from "@/lib/bookings/booking-source"
import { getBookingActionReason } from "@/lib/bookings/booking-needs-action"
import { MANUAL_BOOKING_ANY_STAFF } from "@/lib/bookings/manual-booking-staff"
import { inferBookingStaffDisplayName } from "@/lib/staff/staff-display"
import type { AppointmentReminderSection } from "@/lib/appointments/appointment-reminder-panel-display"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"
import type { Appointment, AppointmentStatus, StaffMember } from "@/types/domain"

export type AppointmentListRowProps = {
  row: Appointment
  isLastInSection: boolean
  dateLabel: string
  timeLabel: string
  reminderSections: AppointmentReminderSection[]
  showNeedsActionReason: boolean
  language: "pl" | "en"
  staffByService: Record<string, StaffMember[]>
  hasActiveTeamMembers: boolean
  statusOrder: readonly AppointmentStatus[]
  allowAppointmentDelete: boolean
  onStaffChange: (nextStaffId: string) => void
  onEditVisit: () => void
  onChangeStatus: (status: AppointmentStatus) => void
  onDeleteRequest: () => void
  showDeleteConfirm: boolean
  onDeleteConfirmDismiss: () => void
  onDeleteConfirm: () => void
  isDeletingAppointment: boolean
  editOpen: boolean
  proposeDate: string
  proposeTime: string
  onProposeDateChange: (iso: string) => void
  onProposeTimeChange: (value: string) => void
  proposeValidationError: string
  proposeStaffId: string
  onProposeStaffIdChange: (id: string) => void
  proposeAvailableStaffIds: ReadonlySet<string> | null
  proposeResolvedServiceId: string
  proposeStaffListForService: StaffMember[] | null
  onCloseEditPanel: () => void
  onSaveEdit: () => void
  saveEditDisabled: boolean
  isSavingDirectEdit: boolean
  confirmCancelVisitOpen: boolean
  onCancelVisitPress: () => void
  onCancelVisitConfirm: () => void
  onRemoveVisitConfirm: () => void
  isCancellingVisit: boolean
}

export function AppointmentListRow({
  row,
  isLastInSection,
  dateLabel,
  timeLabel,
  reminderSections,
  showNeedsActionReason,
  language,
  staffByService,
  hasActiveTeamMembers,
  statusOrder,
  allowAppointmentDelete,
  onStaffChange,
  onEditVisit,
  onChangeStatus,
  onDeleteRequest,
  showDeleteConfirm,
  onDeleteConfirmDismiss,
  onDeleteConfirm,
  isDeletingAppointment,
  editOpen,
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
  onSaveEdit,
  saveEditDisabled,
  isSavingDirectEdit,
  confirmCancelVisitOpen,
  onCancelVisitPress,
  onCancelVisitConfirm,
  onRemoveVisitConfirm,
  isCancellingVisit,
}: AppointmentListRowProps) {
  const { t } = useTranslations()
  const sourceLabel = getBookingSourceLabel(row.source, language)

  return (
    <React.Fragment>
      <div
        className={cn(
          "grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] md:items-start",
          !isLastInSection && "border-b border-border",
        )}
      >
        <div>
          <p className="text-sm font-semibold text-primary">{dateLabel}</p>
          <p className="text-sm text-muted-foreground">{timeLabel}</p>
        </div>

        <div className="min-w-0">
          <p className="font-semibold text-foreground">{row.clientName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{row.serviceLabel}</p>
          {showNeedsActionReason ? (
            <p className="mt-1 max-w-full text-xs leading-snug text-amber-800 dark:text-amber-200/95">
              {getBookingActionReason(row, language)}
            </p>
          ) : null}
          <AppointmentStaffCaption
            appointment={row}
            className="mt-0.5"
            resolvedDisplayName={inferBookingStaffDisplayName(
              row.staffId,
              row.staffName,
              row.serviceId ? staffByService[row.serviceId] : undefined,
            )}
          />
          {row.id.startsWith("sb-") &&
          row.serviceId &&
          staffByService[row.serviceId] !== undefined &&
          staffByService[row.serviceId]!.length === 0 &&
          hasActiveTeamMembers &&
          !(row.staffId?.trim() || row.staffName?.trim()) ? (
            <div className="mt-1 rounded-lg border border-amber-500/25 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-900 dark:text-amber-100">
              <p>{t("appointments.manualNoStaffForService")}</p>
              <Link
                href="/team"
                className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("appointments.manualAssignStaffInTeam")}
              </Link>
            </div>
          ) : null}
          {row.id.startsWith("sb-") &&
          row.serviceId &&
          (staffByService[row.serviceId]?.length ?? 0) >= 1 ? (
            <select
              className="mt-1 h-8 max-w-full rounded-md border border-border bg-background px-2 text-xs"
              value={row.staffId ?? ""}
              onChange={(e) => onStaffChange(e.target.value)}
              aria-label={t("appointments.manualStaffField")}
            >
              <option value="">{t("appointments.staffNotAssignedShort")}</option>
              {(staffByService[row.serviceId] ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
          {row.id.startsWith("sb-") ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("appointments.remindersAutomatedPolicy")}
            </p>
          ) : null}
          {row.id.startsWith("sb-") && reminderSections.length > 0
            ? reminderSections.map((section) => (
                <div
                  key={`${row.id}-${section.title}`}
                  className="mt-1 space-y-0.5 text-xs text-muted-foreground"
                >
                  <p className="font-medium text-muted-foreground">{section.title}</p>
                  <ul className="list-none space-y-0.5 pl-0">
                    {section.channels.map((channel) => (
                      <li key={`${section.title}-${channel.channelLabel}`}>
                        {channel.channelLabel}: {channel.statusLabel}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            : null}
          {row.id.startsWith("sb-") &&
          row.status === "pending" &&
          (row.lastStatusChangeSource === "auto_reminder_24h" ||
            row.lastStatusChangeSource === "automatic_24h_reminder") ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("appointments.statusAutoPendingHint")}
            </p>
          ) : null}
          {row.id.startsWith("sb-") &&
          row.status === "pending" &&
          !row.reminderSentAt &&
          row.lastStatusChangeSource !== "auto_reminder_24h" &&
          row.lastStatusChangeSource !== "automatic_24h_reminder" ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("appointments.waitingClientConfirmation")}
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:max-w-full md:items-end">
          <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
            <StatusBadge status={row.status} />
          </div>
          <AppointmentRowActions
            status={row.status}
            statusOrder={statusOrder}
            onEditVisit={onEditVisit}
            onChangeStatus={onChangeStatus}
            allowAppointmentDelete={allowAppointmentDelete}
            onDelete={onDeleteRequest}
          />
          <p className="text-xs text-muted-foreground md:text-right">{sourceLabel}</p>
        </div>
      </div>

      {showDeleteConfirm ? (
        <div className="mt-2 w-full rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm font-semibold text-foreground">
            {t("appointments.deleteConfirmTitle")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("appointments.deleteConfirmDescription")}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl"
              onClick={onDeleteConfirmDismiss}
              disabled={isDeletingAppointment}
            >
              {t("appointments.deleteConfirmCancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-9 rounded-xl"
              onClick={onDeleteConfirm}
              disabled={isDeletingAppointment}
            >
              {isDeletingAppointment
                ? t("appointments.deleteConfirmActionLoading")
                : t("appointments.deleteConfirmAction")}
            </Button>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="mt-2 w-full rounded-xl border border-border bg-muted/30 p-3">
          <p className="text-sm font-medium text-foreground">{t("appointments.editVisitFormTitle")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor={`p-date-${row.id}`}>{t("appointments.proposePanelDate")}</Label>
              <AppDatePicker
                id={`p-date-${row.id}`}
                value={proposeDate}
                closeOnSelect
                placeholder={t("appointments.fieldDate")}
                onChange={onProposeDateChange}
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`p-time-${row.id}`}>{t("appointments.proposePanelTime")}</Label>
              <Input
                id={`p-time-${row.id}`}
                type="time"
                value={proposeTime}
                onChange={(e) => onProposeTimeChange(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="mt-2 grid gap-1">
            <Label htmlFor={`p-staff-${row.id}`}>{t("appointments.proposePanelStaff")}</Label>
            {(() => {
              const svcId = proposeResolvedServiceId.trim() || row.serviceId?.trim() || ""
              if (!svcId) {
                return (
                  <p id={`p-staff-${row.id}`} className="text-xs text-muted-foreground">
                    {t("appointments.proposeStaffNeedsBookingService")}
                  </p>
                )
              }
              if (proposeStaffListForService === null) {
                return (
                  <p id={`p-staff-${row.id}`} className="text-xs text-muted-foreground">
                    {t("appointments.staffFilterLoading")}
                  </p>
                )
              }
              const effectiveList = proposeStaffListForService
              const availableSet = proposeAvailableStaffIds
              const listAvailable =
                availableSet == null
                  ? effectiveList
                  : effectiveList.filter((s) => availableSet.has(s.id))
              if (effectiveList.length === 0 && hasActiveTeamMembers) {
                return (
                  <div
                    id={`p-staff-${row.id}`}
                    className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-xs text-muted-foreground"
                  >
                    <p>{t("appointments.manualNoStaffForService")}</p>
                    <Link
                      href="/team"
                      className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t("appointments.manualAssignStaffInTeam")}
                    </Link>
                  </div>
                )
              }
              if (effectiveList.length === 0) {
                return (
                  <p id={`p-staff-${row.id}`} className="text-xs text-muted-foreground">
                    {t("appointments.manualNoStaffForService")}
                  </p>
                )
              }
              const canPick = listAvailable.length > 0
              const listAvailableOptions = listAvailable.map((s) => ({
                id: s.id,
                label: s.name?.trim() || s.email?.trim() || "Osoba bez nazwy",
              }))
              const selectValue = canPick
                ? proposeStaffId === MANUAL_BOOKING_ANY_STAFF && listAvailableOptions.length === 1
                  ? listAvailableOptions[0]!.id
                  : proposeStaffId
                : MANUAL_BOOKING_ANY_STAFF
              return (
                <div className="space-y-2">
                  <select
                    id={`p-staff-${row.id}`}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectValue}
                    disabled={!canPick}
                    onChange={(e) => onProposeStaffIdChange(e.target.value)}
                  >
                    {canPick ? (
                      <>
                        {listAvailableOptions.length > 1 ? (
                          <option value={MANUAL_BOOKING_ANY_STAFF}>
                            {t("appointments.manualAnyStaff")}
                          </option>
                        ) : null}
                        {listAvailableOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </>
                    ) : (
                      <option value={MANUAL_BOOKING_ANY_STAFF}>
                        {t("appointments.proposeNoStaffAvailableInSlot")}
                      </option>
                    )}
                  </select>
                  {!canPick ? (
                    <p className="text-xs text-muted-foreground">
                      {t("appointments.proposeNoStaffAvailableInSlot")}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">{t("appointments.proposeStaffHelpText")}</p>
                </div>
              )
            })()}
          </div>
          {proposeValidationError ? (
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200" role="alert">
              {proposeValidationError}
            </p>
          ) : null}
          {confirmCancelVisitOpen ? (
            <div className="mt-3 w-full rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-semibold text-foreground">
                {t("appointments.cancelVisitConfirmMessage")}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 rounded-xl"
                  onClick={onCancelVisitConfirm}
                  disabled={isCancellingVisit}
                >
                  {t("appointments.cancelVisitConfirmBack")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="h-9 rounded-xl"
                  onClick={onRemoveVisitConfirm}
                  disabled={isCancellingVisit}
                >
                  {isCancellingVisit
                    ? t("appointments.cancellingVisit")
                    : t("appointments.cancelVisitConfirmAction")}
                </Button>
              </div>
            </div>
          ) : null}
          {!confirmCancelVisitOpen ? (
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9 w-full rounded-xl sm:w-auto"
              disabled={
                isCancellingVisit || row.status === "cancelled" || confirmCancelVisitOpen
              }
              onClick={onCancelVisitPress}
            >
              {t("appointments.cancelVisit")}
            </Button>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                disabled={isSavingDirectEdit || isCancellingVisit}
                onClick={onCloseEditPanel}
              >
                {t("appointments.closeFormCancel")}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-9 rounded-xl"
                onClick={onSaveEdit}
                disabled={saveEditDisabled}
              >
                {isSavingDirectEdit
                  ? t("appointments.savingVisitChange")
                  : t("appointments.saveVisitChange")}
              </Button>
            </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </React.Fragment>
  )
}
