"use client"

import * as React from "react"

import {
  DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS,
  loadBusinessReminderPanelSettingsForCurrentBusiness,
  type BusinessReminderPanelSettings,
} from "@/lib/appointments/business-reminder-settings"
import { useBusinessAccess } from "@/lib/auth/business-access-context"

export function useBusinessReminderSettings(): BusinessReminderPanelSettings {
  const access = useBusinessAccess()
  const [settings, setSettings] = React.useState<BusinessReminderPanelSettings>(
    DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS,
  )

  React.useEffect(() => {
    let cancelled = false
    if (!access.ready) return
    if (!access.businessId) {
      setSettings(DEFAULT_BUSINESS_REMINDER_PANEL_SETTINGS)
      return
    }
    void (async () => {
      const loaded = await loadBusinessReminderPanelSettingsForCurrentBusiness(access.businessId)
      if (!cancelled) setSettings(loaded)
    })()
    return () => {
      cancelled = true
    }
  }, [access.ready, access.businessId])

  return settings
}
