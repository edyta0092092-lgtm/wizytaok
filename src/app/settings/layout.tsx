"use client"

import * as React from "react"

import { SettingsFormProvider } from "@/lib/settings/settings-form-context"
import { useBusinessAccess } from "@/lib/auth/business-access-context"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { businessId } = useBusinessAccess()
  const [oauthBusinessSetup, setOauthBusinessSetup] = React.useState(() => {
    if (typeof window === "undefined") return false
    return new URLSearchParams(window.location.search).get("setup") === "business"
  })

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    queueMicrotask(() => {
      setOauthBusinessSetup(params.get("setup") === "business")
    })
  }, [])

  return (
    <SettingsFormProvider businessId={businessId} oauthBusinessSetup={oauthBusinessSetup}>
      {children}
    </SettingsFormProvider>
  )
}
