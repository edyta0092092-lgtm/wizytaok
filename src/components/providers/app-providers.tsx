"use client"

import * as React from "react"

import { AppTour } from "@/components/guide/app-tour"
import { BusinessAccessProvider } from "@/lib/auth/business-access-context"
import { PreferencesProvider } from "@/lib/preferences/preferences-provider"
import { TourProvider } from "@/lib/tour/tour-context"

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BusinessAccessProvider>
        <TourProvider>
          {children}
          <AppTour />
        </TourProvider>
      </BusinessAccessProvider>
    </PreferencesProvider>
  )
}
