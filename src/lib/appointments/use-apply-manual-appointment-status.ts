"use client"

import * as React from "react"

import { updateAppointmentStatus } from "@/lib/appointments/appointments-store"
import type { AppointmentStatus } from "@/types/domain"

/** Zmiana statusu wizyty z listy (źródło „manual”) + komunikat o sukcesie. */
export function useApplyManualAppointmentStatus(
  t: (key: string) => string,
  setActionNotice: React.Dispatch<React.SetStateAction<string>>,
) {
  return React.useCallback(
    (id: string, status: AppointmentStatus) => {
      void (async () => {
        const ok = await updateAppointmentStatus(id, status, {
          lastUpdatedBy: "business",
          lastStatusChangeSource: "manual",
        })
        if (!ok) return
        setActionNotice(t("appointments.statusUpdated"))
      })()
    },
    [t, setActionNotice],
  )
}
