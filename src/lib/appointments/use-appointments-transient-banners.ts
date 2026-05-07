"use client"

import * as React from "react"

/**
 * Ukrywa komunikat „dodano” i tymczasowe `actionNotice` po krótkim czasie (jak na stronie wizyt).
 */
export function useAppointmentsTransientBanners(args: {
  showAdded: boolean
  setShowAdded: React.Dispatch<React.SetStateAction<boolean>>
  actionNotice: string
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
}): void {
  const { showAdded, setShowAdded, actionNotice, setActionNotice } = args

  React.useEffect(() => {
    if (!showAdded) return
    const tid = window.setTimeout(() => setShowAdded(false), 2500)
    return () => window.clearTimeout(tid)
  }, [showAdded, setShowAdded])

  React.useEffect(() => {
    if (!actionNotice) return
    const tid = window.setTimeout(() => setActionNotice(""), 2800)
    return () => window.clearTimeout(tid)
  }, [actionNotice, setActionNotice])
}
