"use client"

import * as React from "react"
import Link from "next/link"

import { AppointmentRowActions } from "@/components/appointments/appointment-row-actions"
import { SendCustomMessageButton } from "@/components/appointments/send-custom-message-button"
import { AppointmentStaffCaption } from "@/components/shared/appointment-staff-caption"
import { StatusBadge } from "@/components/shared/status-badge"
import { AppDatePicker } from "@/components/ui/app-date-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  allocateAppointmentAttachmentId,
  readFileAsDataUrl,
  useAppointmentAttachments,
  type AppointmentAttachment,
} from "@/lib/appointments/appointment-attachments"
import { bookingNeedsAction, getBookingActionReason } from "@/lib/bookings/booking-needs-action"
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
  remindersAutomatedPolicy: string
  reminderNoRowsMessage: string
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
  proposeCustomerNote: string
  onProposeDateChange: (iso: string) => void
  onProposeTimeChange: (value: string) => void
  onProposeCustomerNoteChange: (value: string) => void
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
  remindersAutomatedPolicy,
  reminderNoRowsMessage,
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
  const [attachments, setAttachments] = useAppointmentAttachments(row.id)
  const [attachmentError, setAttachmentError] = React.useState("")
  const editPanelRef = React.useRef<HTMLDivElement | null>(null)
  const customerNote = (row.customerNote?.trim() || row.notes?.trim() || "").trim()
  const acceptedAttachmentTypes = "image/jpeg,image/jpg,image/png,application/pdf"

  const formatAttachmentSize = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
    return `${bytes} B`
  }

  const isAllowedAttachment = (file: File): boolean =>
    file.type === "application/pdf" ||
    file.type === "image/jpeg" ||
    file.type === "image/jpg" ||
    file.type === "image/png"

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setAttachmentError("")
    const next: AppointmentAttachment[] = []
    for (const file of Array.from(files)) {
      if (!isAllowedAttachment(file)) {
        setAttachmentError(t("appointments.attachmentInvalidType"))
        return
      }
      if (file.size > 4 * 1024 * 1024) {
        setAttachmentError(t("appointments.attachmentTooLarge"))
        return
      }
      try {
        next.push({
          id: allocateAppointmentAttachmentId(),
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
          createdAt: new Date().toISOString(),
        })
      } catch {
        setAttachmentError(t("appointments.attachmentReadFailed"))
        return
      }
    }
    setAttachments((prev) => [...prev, ...next])
  }

  React.useEffect(() => {
    if (!editOpen) return
    const frame = window.requestAnimationFrame(() => {
      editPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editOpen, row.id])

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
          {customerNote ? (
            <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-foreground">
              <p className="font-semibold text-muted-foreground">
                {t("appointments.customerNoteLabel")}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{customerNote}</p>
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs leading-relaxed text-foreground">
              <p className="font-semibold text-muted-foreground">
                {t("appointments.attachmentsLabel")}
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{attachment.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatAttachmentSize(attachment.size)}
                      </p>
                    </div>
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 rounded-lg px-2 text-xs"
                    >
                      <a href={attachment.dataUrl} download={attachment.name}>
                        {t("appointments.attachmentDownload")}
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
            <NativeSelect
              wrapperClassName="mt-1 max-w-full"
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
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
            </NativeSelect>
          ) : null}
          {row.id.startsWith("sb-") ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {remindersAutomatedPolicy}
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
          {row.id.startsWith("sb-") && reminderSections.length === 0 && reminderNoRowsMessage ? (
            <p className="mt-1 text-xs text-muted-foreground">{reminderNoRowsMessage}</p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-2 md:max-w-full md:items-end">
          <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
            <StatusBadge status={row.status} needsAction={bookingNeedsAction(row)} />
          </div>
          <AppointmentRowActions
            status={row.status}
            statusOrder={statusOrder}
            onEditVisit={onEditVisit}
            onChangeStatus={onChangeStatus}
            allowAppointmentDelete={allowAppointmentDelete}
            onDelete={onDeleteRequest}
          />
          {row.id.startsWith("sb-") && row.status !== "cancelled" ? (
            <SendCustomMessageButton appointmentId={row.id} />
          ) : null}
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
        <div
          ref={editPanelRef}
          className="relative mt-4 w-full scroll-mt-24 overflow-hidden rounded-2xl border border-primary/35 bg-primary/5 p-4 shadow-lg shadow-primary/10 ring-1 ring-primary/10 dark:bg-primary/10"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-primary/60" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t("appointments.editVisitFormTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("appointments.editVisitFormHint")}
              </p>
            </div>
            <span className="rounded-full border border-primary/25 bg-background/80 px-3 py-1 text-xs font-medium text-primary">
              {t("appointments.editVisitBadge")}
            </span>
          </div>
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
                  <NativeSelect
                    id={`p-staff-${row.id}`}
                    wrapperClassName="w-full"
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
                  </NativeSelect>
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
          <div className="mt-3 grid gap-1">
            <Label htmlFor={`p-note-${row.id}`}>{t("appointments.customerNoteLabel")}</Label>
            <Textarea
              id={`p-note-${row.id}`}
              value={proposeCustomerNote}
              onChange={(e) => onProposeCustomerNoteChange(e.target.value)}
              placeholder={t("appointments.customerNotePlaceholder")}
              className="min-h-24 rounded-xl"
            />
          </div>
          <div className="mt-3 rounded-xl border border-border/80 bg-card/70 px-3 py-3">
            <Label htmlFor={`p-attachments-${row.id}`}>{t("appointments.attachmentsLabel")}</Label>
            <Input
              id={`p-attachments-${row.id}`}
              type="file"
              accept={acceptedAttachmentTypes}
              multiple
              className="mt-2 h-auto cursor-pointer py-2"
              onChange={(event) => {
                void handleAttachmentUpload(event.target.files)
                event.currentTarget.value = ""
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t("appointments.attachmentHelp")}</p>
            {attachmentError ? (
              <p className="mt-2 text-xs text-destructive" role="alert">
                {attachmentError}
              </p>
            ) : null}
            {attachments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatAttachmentSize(attachment.size)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button asChild type="button" variant="outline" size="sm" className="h-8 rounded-lg">
                        <a href={attachment.dataUrl} download={attachment.name}>
                          {t("appointments.attachmentDownload")}
                        </a>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((item) => item.id !== attachment.id))
                        }
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
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
