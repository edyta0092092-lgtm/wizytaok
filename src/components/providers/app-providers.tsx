"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { BusinessAccessProvider } from "@/lib/auth/business-access-context"
import { PreferencesProvider } from "@/lib/preferences/preferences-provider"
import { useDeferUntilIdle } from "@/lib/react/use-defer-until-idle"
import { TourProvider } from "@/lib/tour/tour-context"

const AppTourLazy = dynamic(
  () => import("@/components/guide/app-tour").then((m) => ({ default: m.AppTour })),
  { ssr: false },
)

function DeferredAppTour() {
  const ready = useDeferUntilIdle(500)
  if (!ready) return null
  return <AppTourLazy />
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BusinessAccessProvider>
        <TourProvider>
          {children}
          <DeferredAppTour />
        </TourProvider>
      </BusinessAccessProvider>
    </PreferencesProvider>
  )
}
