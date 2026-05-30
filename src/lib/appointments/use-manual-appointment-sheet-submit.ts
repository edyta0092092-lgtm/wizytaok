"use client"

import * as React from "react"

import type { ManualAppointmentFormState } from "@/components/appointments/manual-appointment-sheet"
import {
  submitManualAppointmentSheet,
  type SubmitManualSheetFailureReason,
} from "@/lib/appointments/submit-manual-appointment-sheet"
import type { Service, StaffMember } from "@/types/domain"

function failureReasonToMessage(
  reason: SubmitManualSheetFailureReason,
  t: (key: string) => string,
): string {
  if (reason.code === "slot_required") return t("bookingPublic.slotHelp")
  if (reason.code === "no_service") return t("appointments.manualChooseService")
  if (reason.code === "staff_resolution") return t(reason.errorKey)
  return reason.error === "slot_taken"
    ? t("bookings.slotAlreadyTaken")
    : t("appointments.manualSaveFailed")
}

export type UseManualAppointmentSheetSubmitParams = {
  businessId: string | null
  form: ManualAppointmentFormState
  selectedService: Service | null
  manualStaffForService: StaffMember[]
  hasActiveTeamMembers: boolean
  language?: "pl" | "en"
  t: (key: string) => string
  setActionNotice: (v: string) => void
  setIsSaving: (v: boolean) => void
  setSheetOpen: (open: boolean) => void
  setShowAddedBanner: (v: boolean) => void
}

export function useManualAppointmentSheetSubmit(
  p: UseManualAppointmentSheetSubmitParams,
): (e: React.FormEvent) => void {
  const {
    businessId,
    form,
    selectedService,
    manualStaffForService,
    hasActiveTeamMembers,
    language,
    t,
    setActionNotice,
    setIsSaving,
    setSheetOpen,
    setShowAddedBanner,
  } = p

  return React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      void (async () => {
        setIsSaving(true)
        try {
          const result = await submitManualAppointmentSheet({
            businessId,
            form,
            selectedService,
            manualStaffForService,
            hasActiveTeamMembers,
            language,
          })
          if (!result.ok) {
            setActionNotice(failureReasonToMessage(result.reason, t))
            return
          }
          window.dispatchEvent(new Event("pw-bookings"))
          setActionNotice(t("appointments.appointmentAdded"))
          setSheetOpen(false)
          setShowAddedBanner(true)
        } finally {
          setIsSaving(false)
        }
      })()
    },
    [
      businessId,
      form,
      selectedService,
      manualStaffForService,
      hasActiveTeamMembers,
      language,
      t,
      setActionNotice,
      setIsSaving,
      setSheetOpen,
      setShowAddedBanner,
    ],
  )
}
