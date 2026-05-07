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
    appointments,
    language,
    t,
    setActionNotice,
    setConfirmDeleteAppointmentId,
  } = args

  return React.useCallback(() => {
    const deletingId = (confirmDeleteAppointmentIdRef.current ?? "").trim()
    if (!deletingId || isDeletingAppointment || !allowAppointmentDelete) return
    void (async () => {
      setIsDeletingAppointment(true)
      try {
        const row = appointments.find((a) => a.id === deletingId)
        const result = await cancelAppointmentFromRemove(deletingId, language)
        console.info("[appointments.cancelFromDelete]", {
          bookingId: deletingId,
          oldStatus: row?.status,
          nextStatus: "cancelled",
          error: result.ok ? undefined : result.error,
        })
        if (!result.ok) {
          const detail =
            result.error === "missing_appointment_id"
              ? t("appointments.appointmentCancelFromRemoveMissingIdDetail")
              : result.error === "unknown_appointment_id"
                ? `${result.error} (id=${deletingId})`
                : (result.error ?? "unknown")
          setActionNotice(t("appointments.appointmentCancelFromRemoveFailed").replace("{detail}", detail))
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
    appointments,
    confirmDeleteAppointmentIdRef,
    isDeletingAppointment,
    language,
    setActionNotice,
    setConfirmDeleteAppointmentId,
    setIsDeletingAppointment,
    t,
  ])
}
