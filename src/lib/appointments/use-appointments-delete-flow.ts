"use client"

import * as React from "react"

import { useConfirmDeleteAppointmentHandler } from "@/lib/appointments/use-confirm-delete-appointment-handler"
import { useSyncedRef } from "@/lib/appointments/use-synced-ref"
import type { Appointment } from "@/types/domain"

export function useAppointmentsDeleteFlow(input: {
  allowAppointmentDelete: boolean
  appointments: Appointment[]
  businessId?: string | null
  language: "en" | "pl"
  t: (key: string) => string
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
}) {
  const { allowAppointmentDelete, appointments, businessId, language, t, setActionNotice } = input

  const [confirmDeleteAppointmentId, setConfirmDeleteAppointmentId] =
    React.useState<string | null>(null)
  const [isDeletingAppointment, setIsDeletingAppointment] = React.useState(false)
  const confirmDeleteAppointmentIdRef = useSyncedRef(confirmDeleteAppointmentId)

  /** Bez uprawnień delete użytkownik nie widzi potwierdzenia; nie czyść stanu synchronicznie w efekcie (lint). */
  const effectiveConfirmDeleteAppointmentId = allowAppointmentDelete
    ? confirmDeleteAppointmentId
    : null

  const handleConfirmDeleteAppointment = useConfirmDeleteAppointmentHandler({
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
  })

  return {
    setConfirmDeleteAppointmentId,
    effectiveConfirmDeleteAppointmentId,
    handleConfirmDeleteAppointment,
    isDeletingAppointment,
  }
}
