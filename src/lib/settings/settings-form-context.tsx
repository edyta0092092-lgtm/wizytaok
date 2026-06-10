"use client"

import * as React from "react"

import { useSettingsForm } from "@/lib/settings/use-settings-form"
import type { SettingsForm } from "@/lib/settings/settings-form-types"

type SettingsFormContextValue = ReturnType<typeof useSettingsForm>

const SettingsFormContext = React.createContext<SettingsFormContextValue | null>(null)

export function SettingsFormProvider({
  businessId,
  oauthBusinessSetup,
  children,
}: {
  businessId: string | null | undefined
  oauthBusinessSetup: boolean
  children: React.ReactNode
}) {
  const value = useSettingsForm(businessId, oauthBusinessSetup)
  return <SettingsFormContext.Provider value={value}>{children}</SettingsFormContext.Provider>
}

export function useSettingsFormContext(): SettingsFormContextValue {
  const ctx = React.useContext(SettingsFormContext)
  if (!ctx) {
    throw new Error("useSettingsFormContext must be used within SettingsFormProvider")
  }
  return ctx
}

export type { SettingsForm }
