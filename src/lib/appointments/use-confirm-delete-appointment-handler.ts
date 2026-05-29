"use client"

import * as React from "react"

import { dismissAppointmentFromPanel } from "@/lib/appointments/appointments-panel-dismissed"
import { cancelAppointmentFromRemove } from "@/lib/appointments/cancel-appointment-from-remove"
import { invalidateMergedAppointmentsCache } from "@/lib/appointments/appointments-store"
import type { Appointment } from "@/types/domain"

export function useConfirmDeleteAppointmentHandler(args: {
  confirmDeleteAppointmentIdRef: React.RefObject<string | null>
  isDeletingAppointment: boolean
  setIsDeletingAppointment: React.Dispatch<React.SetStateAction<boolean>>
  allowAppointmentDelete: boolean
  appointments: Appointment[]
  businessId?: string | null
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
    businessId,
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

        // Wizyta już anulowana: tylko chowamy ją z panelu. Status w bazie się nie
        // zmienia, więc statystyki nadal liczą ją jako anulowaną.
        if (row?.status !== "cancelled") {
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
        }

        dismissAppointmentFromPanel(deletingId, businessId)
        invalidateMergedAppointmentsCache()
        setActionNotice(t("appointments.appointmentRemovedFromList"))
        setConfirmDeleteAppointmentId(null)
      } finally {
        setIsDeletingAppointment(false)
      }
    })()
  }, [
    allowAppointmentDelete,
    appointments,
    businessId,
    confirmDeleteAppointmentIdRef,
    isDeletingAppointment,
    language,
    setActionNotice,
    setConfirmDeleteAppointmentId,
    setIsDeletingAppointment,
    t,
  ])
}
