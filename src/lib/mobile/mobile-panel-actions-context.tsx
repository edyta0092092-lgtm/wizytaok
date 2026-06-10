"use client"

import * as React from "react"

type MobilePanelActionsContextValue = {
  openNewAppointment: () => void
  openNewClient: () => void
}

const MobilePanelActionsContext = React.createContext<MobilePanelActionsContextValue | null>(null)

export function MobilePanelActionsProvider({
  value,
  children,
}: {
  value: MobilePanelActionsContextValue
  children: React.ReactNode
}) {
  return (
    <MobilePanelActionsContext.Provider value={value}>{children}</MobilePanelActionsContext.Provider>
  )
}

export function useMobilePanelActions(): MobilePanelActionsContextValue | null {
  return React.useContext(MobilePanelActionsContext)
}
