"use client"

import * as React from "react"

import { dismissAppointmentFromPanel } from "@/lib/appointments/appointments-panel-dismissed"
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
    businessId,
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
        // „Usuń" wyłącznie chowa wizytę z panelu — NIE zmienia jej statusu w bazie.
        // Dzięki temu każdy status (zrealizowana, potwierdzona, anulowana,
        // nieobecność) nadal zasila statystyki.
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
    businessId,
    confirmDeleteAppointmentIdRef,
    isDeletingAppointment,
    setActionNotice,
    setConfirmDeleteAppointmentId,
    setIsDeletingAppointment,
    t,
  ])
}
