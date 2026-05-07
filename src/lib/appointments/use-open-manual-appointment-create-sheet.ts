"use client"

import * as React from "react"

import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import { EMPTY_MANUAL_APPOINTMENT_FORM } from "@/lib/appointments/manual-appointment-form-defaults"

export function useOpenManualAppointmentCreateSheet(
  setForm: React.Dispatch<React.SetStateAction<ManualAppointmentFormState>>,
  setCreateOpen: (open: boolean) => void,
): () => void {
  return React.useCallback(() => {
    setForm(EMPTY_MANUAL_APPOINTMENT_FORM)
    setCreateOpen(true)
  }, [setForm, setCreateOpen])
}
