"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { BusinessAccessProvider } from "@/lib/auth/business-access-context"
import { PreferencesProvider } from "@/lib/preferences/preferences-provider"
import { useDeferUntilIdle } from "@/lib/react/use-defer-until-idle"
import { OnboardingProvider } from "@/lib/onboarding/onboarding-provider"

const OnboardingWelcomeLazy = dynamic(
  () =>
    import("@/components/onboarding/onboarding-welcome-modal").then((m) => ({
      default: m.OnboardingWelcomeModal,
    })),
  { ssr: false },
)

const OnboardingFlowHintLazy = dynamic(
  () =>
    import("@/components/onboarding/onboarding-flow-hint").then((m) => ({
      default: m.OnboardingFlowHint,
    })),
  { ssr: false },
)

function DeferredOnboardingUi() {
  const ready = useDeferUntilIdle(400)
  if (!ready) return null
  return (
    <>
      <OnboardingWelcomeLazy />
      <OnboardingFlowHintLazy />
    </>
  )
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PreferencesProvider>
      <BusinessAccessProvider>
        <OnboardingProvider>
          {children}
          <DeferredOnboardingUi />
        </OnboardingProvider>
      </BusinessAccessProvider>
    </PreferencesProvider>
  )
}
