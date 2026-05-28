"use client"

import * as React from "react"

import { cancelAppointmentFromRemove } from "@/lib/appointments/cancel-appointment-from-remove"
import type { Appointment } from "@/types/domain"

export function useConfirmDeleteAppointmentHandler(args: {
  confirmDeleteAppointmentIdRef: React.RefObject<string | null>
  isDeletingAppointment: boolean
  setIsDeletingAppointment: React.Dispatch<React.SetStateAction<boolean>>
  allowAppointmentDelete: boolean
  appointments: Appointment[]
  language: "en" | "pl"
  t: (key: string) => string
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
  setConfirmDeleteAppointmentId: React.Dispatch<React.SetStateAction<string | null>>
}): () => void {
  const {
    confirmDeleteAppointmentIdRef,
    isDeletingAppointment,
    setIsDeletingAppointment,
    allowAppointmentDelete,
    appointments: _appointments,
    language,
    t,
    setActionNotice,
    setConfirmDeleteAppointmentId,
  } = args
  void _appointments

  return React.useCallback(() => {
    const deletingId = (confirmDeleteAppointmentIdRef.current ?? "").trim()
    if (!deletingId || isDeletingAppointment || !allowAppointmentDelete) return
    void (async () => {
      setIsDeletingAppointment(true)
      try {
        const result = await cancelAppointmentFromRemove(deletingId, language, false)
        if (!result.ok) {
          const detail =
            result.error && result.error.trim().length > 0
              ? result.error
              : t("appointments.appointmentCancelFromRemoveMissingIdDetail")
          setActionNotice(
            t("appointments.appointmentCancelFromRemoveFailed").replace("{detail}", detail),
          )
          return
        }
        setActionNotice(t("appointments.appointmentCancelledFromRemove"))
        setConfirmDeleteAppointmentId(null)
      } finally {
        setIsDeletingAppointment(false)
      }
    })()
  }, [
    allowAppointmentDelete,
    confirmDeleteAppointmentIdRef,
    isDeletingAppointment,
    setActionNotice,
    setConfirmDeleteAppointmentId,
    setIsDeletingAppointment,
    t,
  ])
}
