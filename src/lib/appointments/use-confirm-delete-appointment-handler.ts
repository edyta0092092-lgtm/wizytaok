"use client"

import * as React from "react"

import { deleteManualAppointment, unwrapManualAppointmentId } from "@/lib/appointments/manual-appointments"
import {
  deleteBooking,
  resolveSupabaseBookingRowUuidFromUiId,
} from "@/lib/bookings/bookings-store"
import { removePublicBooking, unwrapPublicAppointmentId } from "@/lib/bookings/public-bookings"
import { getCurrentBusinessProfileIdForClient } from "@/lib/services/services-store"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"
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
    language: _language,
    t,
    setActionNotice,
    setConfirmDeleteAppointmentId,
  } = args
  void _appointments
  void _language

  return React.useCallback(() => {
    const deletingId = (confirmDeleteAppointmentIdRef.current ?? "").trim()
    if (!deletingId || isDeletingAppointment || !allowAppointmentDelete) return
    void (async () => {
      setIsDeletingAppointment(true)
      try {
        const publicId = unwrapPublicAppointmentId(deletingId)
        if (publicId) {
          removePublicBooking(publicId)
          window.dispatchEvent(new Event("pw-bookings"))
          setActionNotice(t("appointments.appointmentDeleted"))
          setConfirmDeleteAppointmentId(null)
          return
        }

        const manualId = unwrapManualAppointmentId(deletingId)
        if (manualId) {
          deleteManualAppointment(manualId)
          window.dispatchEvent(new Event("pw-bookings"))
          setActionNotice(t("appointments.appointmentDeleted"))
          setConfirmDeleteAppointmentId(null)
          return
        }

        const bookingUuid = resolveSupabaseBookingRowUuidFromUiId(deletingId)
        if (!bookingUuid) {
          const detail = `${t("appointments.appointmentDeleteMissingId")} (id=${deletingId})`
          setActionNotice(
            `${t("appointments.appointmentDeleteFailed")} ${t("appointments.appointmentDeleteFailedDetailLine").replace("{detail}", detail)}`,
          )
          return
        }

        const client = getBrowserClient()
        if (!client || !isSupabaseConfigured()) {
          setActionNotice(t("appointments.appointmentDeleteFailed"))
          return
        }
        const businessId = await getCurrentBusinessProfileIdForClient(client)
        if (!businessId) {
          setActionNotice(t("appointments.appointmentDeleteFailed"))
          return
        }
        const result = await deleteBooking(client, businessId, bookingUuid)
        if (!result.ok) {
          const detail =
            result.error && result.error.trim().length > 0
              ? result.error
              : t("appointments.appointmentDeleteMissingId")
          setActionNotice(
            `${t("appointments.appointmentDeleteFailed")} ${t("appointments.appointmentDeleteFailedDetailLine").replace("{detail}", detail)}`,
          )
          return
        }
        setActionNotice(t("appointments.appointmentDeleted"))
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
