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
        if (row?.status === "cancelled") {
          dismissAppointmentFromPanel(deletingId, businessId)
          invalidateMergedAppointmentsCache()
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("pw-bookings"))
          }
          setActionNotice(t("appointments.appointmentRemovedFromList"))
          setConfirmDeleteAppointmentId(null)
          return
        }

        const result = await cancelAppointmentFromRemove(
          deletingId,
          language,
          false,
          businessId,
        )
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
