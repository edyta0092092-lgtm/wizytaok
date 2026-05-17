"use client"

import * as React from "react"

/** Ukrywa tymczasowe `actionNotice` po krótkim czasie. */
export function useAppointmentsTransientBanners(args: {
  actionNotice: string
  setActionNotice: React.Dispatch<React.SetStateAction<string>>
}): void {
  const { actionNotice, setActionNotice } = args

  React.useEffect(() => {
    if (!actionNotice) return
    const tid = window.setTimeout(() => setActionNotice(""), 2800)
    return () => window.clearTimeout(tid)
  }, [actionNotice, setActionNotice])
}
