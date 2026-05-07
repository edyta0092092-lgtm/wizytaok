"use client"

import * as React from "react"

import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { canSubmitManualAppointment } from "@/lib/appointments/can-submit-manual-appointment"
import { EMPTY_MANUAL_APPOINTMENT_FORM } from "@/lib/appointments/manual-appointment-form-defaults"
import { useManualAppointmentSheetData } from "@/lib/appointments/use-manual-appointment-sheet-data"
import { useManualAppointmentSheetSubmit } from "@/lib/appointments/use-manual-appointment-sheet-submit"
import { useOpenManualAppointmentCreateSheet } from "@/lib/appointments/use-open-manual-appointment-create-sheet"

export function useManualAppointmentCreateSheet(input: {
  hasActiveTeamMembers: boolean
  t: (key: string) => string
  setActionNotice: (v: string) => void
  setShowAdded: (v: boolean) => void
}) {
  const { hasActiveTeamMembers, t, setActionNotice, setShowAdded } = input

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [form, setForm] = React.useState<ManualAppointmentFormState>(EMPTY_MANUAL_APPOINTMENT_FORM)

  const { manualServiceOptions, manualStaffForService } = useManualAppointmentSheetData(
    form.serviceId,
    setForm,
  )

  const selectedServiceForManual = React.useMemo(
    () => manualServiceOptions.find((s) => s.id === form.serviceId) ?? null,
    [manualServiceOptions, form.serviceId],
  )

  const canSubmitManual = canSubmitManualAppointment({
    form,
    hasActiveTeamMembers,
    manualStaffForServiceCount: manualStaffForService.length,
  })

  const openCreate = useOpenManualAppointmentCreateSheet(setForm, setSheetOpen)

  const saveManual = useManualAppointmentSheetSubmit({
    form,
    selectedService: selectedServiceForManual,
    manualStaffForService,
    hasActiveTeamMembers,
    t,
    setActionNotice,
    setIsSaving,
    setSheetOpen,
    setShowAddedBanner: setShowAdded,
  })

  return {
    sheetOpen,
    setSheetOpen,
    form,
    setForm,
    isSaving,
    manualServiceOptions,
    manualStaffForService,
    canSubmitManual,
    openCreate,
    saveManual,
  }
}
