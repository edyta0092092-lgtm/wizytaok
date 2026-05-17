"use client"

import * as React from "react"
import Link from "next/link"

import { FormActions } from "@/components/shared/form-actions"
import { InternationalPhoneFieldGroup } from "@/components/forms/international-phone-field-group"
import { AppDatePicker } from "@/components/ui/app-date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { ManualAppointment } from "@/lib/appointments/manual-appointments"
import { MANUAL_BOOKING_ANY_STAFF } from "@/lib/bookings/manual-booking-staff"
import { useTranslations } from "@/lib/i18n/use-translations"
import type { Service, StaffMember } from "@/types/domain"

export type ManualAppointmentFormState = {
  clientFirstName: string
  clientLastName: string
  clientPhoneDialCode: string
  clientPhoneNational: string
  clientEmail: string
  serviceId: string
  manualStaffId: string
  date: string
  time: string
  status: ManualAppointment["status"]
  note: string
}

export type ManualAppointmentSheetProps = {
  open: boolean
  onOpenChange: (nextOpen: boolean) => void
  form: ManualAppointmentFormState
  setForm: React.Dispatch<React.SetStateAction<ManualAppointmentFormState>>
  manualServiceOptions: Service[]
  manualStaffForService: StaffMember[]
  manualAvailableStaffIds: Set<string> | null
  hasActiveTeamMembers: boolean
  canSubmitManualAppointment: boolean
  isSaving: boolean
  language: string
  onSubmit: (e: React.FormEvent) => void
}

export function ManualAppointmentSheet({
  open,
  onOpenChange,
  form,
  setForm,
  manualServiceOptions,
  manualStaffForService,
  manualAvailableStaffIds,
  hasActiveTeamMembers,
  canSubmitManualAppointment,
  isSaving,
  language,
  onSubmit,
}: ManualAppointmentSheetProps) {
  const { t } = useTranslations()
  const availableStaffForSlot =
    manualAvailableStaffIds == null
      ? manualStaffForService
      : manualStaffForService.filter((s) => manualAvailableStaffIds.has(s.id))
  const hasSlotSelected = Boolean(form.date.trim() && form.time.trim())

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg" showCloseButton>
        <SheetHeader className="border-b border-border/70 px-6 py-5 text-left">
          <SheetTitle>{t("common.addAppointment")}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="premium-scrollbar flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 px-6 py-5 pb-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("appointments.manualContactHint")}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="text-destructive" aria-hidden="true">
                *
              </span>{" "}
              {t("bookingPublic.required")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ma-client-first">
                  {t("appointments.fieldClientFirstName")}
                  <span className="text-destructive" aria-hidden="true">
                    {" "}
                    *
                  </span>
                </Label>
                <Input
                  id="ma-client-first"
                  required
                  value={form.clientFirstName}
                  onChange={(e) => setForm((f) => ({ ...f, clientFirstName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ma-client-last">
                  {t("appointments.fieldClientLastName")}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    ({t("bookingPublic.fieldOptional")})
                  </span>
                </Label>
                <Input
                  id="ma-client-last"
                  value={form.clientLastName}
                  onChange={(e) => setForm((f) => ({ ...f, clientLastName: e.target.value }))}
                />
              </div>
            </div>
            <InternationalPhoneFieldGroup
              label={`${t("appointments.fieldPhone")} *`}
              dialCode={form.clientPhoneDialCode}
              nationalDigits={form.clientPhoneNational}
              onDialCodeChange={(v) => setForm((f) => ({ ...f, clientPhoneDialCode: v }))}
              onNationalChange={(digits) =>
                setForm((f) => ({ ...f, clientPhoneNational: digits }))
              }
              dialSelectId="ma-phone-dial"
              nationalInputId="ma-phone"
            />
            <div className="space-y-1">
              <Label htmlFor="ma-email">
                {t("appointments.fieldEmail")}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({t("bookingPublic.fieldOptional")})
                </span>
              </Label>
              <Input
                id="ma-email"
                type="email"
                value={form.clientEmail}
                onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ma-service">{t("appointments.fieldService")}</Label>
              <select
                id="ma-service"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.serviceId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serviceId: e.target.value, manualStaffId: "" }))
                }
              >
                <option value="" disabled>
                  {t("appointments.manualChooseService")}
                </option>
                {manualServiceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${s.name} - ${s.durationMinutes} min - ${s.price} ${s.currency ?? "PLN"}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ma-staff">{t("appointments.manualStaffField")}</Label>
              {!form.serviceId.trim() ? (
                <p className="text-sm text-muted-foreground">
                  {t("appointments.manualChooseServiceFirst")}
                </p>
              ) : availableStaffForSlot.length === 1 ? (
                <p id="ma-staff" className="text-sm font-medium text-foreground">
                  {availableStaffForSlot[0]!.name}
                </p>
              ) : availableStaffForSlot.length > 1 ? (
                <select
                  id="ma-staff"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.manualStaffId}
                  onChange={(e) => setForm((f) => ({ ...f, manualStaffId: e.target.value }))}
                >
                  <option value={MANUAL_BOOKING_ANY_STAFF}>
                    {t("appointments.manualAnyStaff")}
                  </option>
                  {availableStaffForSlot.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : manualStaffForService.length > 0 && hasSlotSelected ? (
                <p id="ma-staff" className="text-sm text-muted-foreground">
                  {t("appointments.proposeNoStaffAvailableInSlot")}
                </p>
              ) : hasActiveTeamMembers ? (
                <p id="ma-staff" className="text-sm text-muted-foreground">
                  {t("appointments.manualNoStaffForService")}
                </p>
              ) : (
                <p id="ma-staff" className="text-sm text-muted-foreground">
                  {t("appointments.staffNotAssignedShort")}
                </p>
              )}
              {form.serviceId.trim() && manualStaffForService.length === 0 && hasActiveTeamMembers ? (
                <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <p>{t("appointments.manualNoStaffForService")}</p>
                  <Link
                    href="/team"
                    className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {t("appointments.manualAssignStaffInTeam")}
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ma-date">{t("appointments.fieldDate")}</Label>
                <AppDatePicker
                  id="ma-date"
                  required
                  value={form.date}
                  placeholder={t("appointments.fieldDate")}
                  closeOnSelect
                  onChange={(iso) => setForm((f) => ({ ...f, date: iso }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ma-time">{t("appointments.fieldTime")}</Label>
                <Input
                  id="ma-time"
                  type="time"
                  required
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ma-status">{t("appointments.fieldStatus")}</Label>
              <select
                id="ma-status"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as ManualAppointment["status"],
                  }))
                }
              >
                <option value="confirmed">{t("labels.appointmentStatus.confirmed")}</option>
                <option value="cancelled">{t("labels.appointmentStatus.cancelled")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ma-note">{t("appointments.fieldNote")}</Label>
              <Textarea
                id="ma-note"
                rows={3}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <SheetFooter className="mt-3 shrink-0 border-t border-border/70 bg-background px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <FormActions
              cancelLabel={t("messages.cancel")}
              submitLabel={t("appointments.saveAppointment")}
              submittingLabel={language === "en" ? "Saving..." : "Zapisywanie..."}
              isSubmitting={isSaving}
              submitDisabled={!canSubmitManualAppointment}
              onCancel={() => onOpenChange(false)}
            />
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
