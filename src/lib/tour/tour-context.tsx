"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { TOUR_STEPS } from "@/lib/guide/tour-steps"
import { TOUR_KEYS, writeTourRuntimeState } from "@/lib/tour/tour-storage"
import {
  clearPanelAccessJustActivated,
  hasPendingAccessActivationForBusiness,
  isWelcomeHandledForBusiness,
  markPanelAccessJustActivated,
  markWelcomeHandledForBusiness,
} from "@/lib/tour/tour-access-activation"
import {
  isPanelWelcomePopupPath,
  isPublicTourBlockedPath,
} from "@/lib/tour/tour-path-guard"
import { usePanelOnboardingEligibility } from "@/lib/tour/use-panel-onboarding-eligibility"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

function setLegacyWelcomeDismissed() {
  try {
    window.localStorage.setItem(TOUR_KEYS.welcomeDismissed, "1")
  } catch {
    /* ignore */
  }
}

type TourContextValue = {
  welcomeOpen: boolean
  tourActive: boolean
  stepIndex: number
  tourReady: boolean
  /** false na landing / public / bez aktywnej subskrypcji. */
  canShowOnboardingUi: boolean
  openWelcome: () => void
  dismissWelcome: () => void
  startTour: (fromStepIndex?: number) => void
  nextStep: () => void
  prevStep: () => void
  skipTour: () => void
  finishTour: () => void
  endTourEarly: () => void
}

const TourContext = React.createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { businessId, ready: accessReady } = useBusinessAccess()

  const [userId, setUserId] = React.useState("")
  const [tourReady, setTourReady] = React.useState(false)
  const [welcomeOpen, setWelcomeOpen] = React.useState(false)
  const [tourActive, setTourActive] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)

  const { ready: eligibilityReady, eligible: panelOnboardingEligible } =
    usePanelOnboardingEligibility(tourActive)

  const canShowOnboardingUi =
    tourReady && eligibilityReady && panelOnboardingEligible && (welcomeOpen || tourActive)

  const persistStep = React.useCallback((active: boolean, step: number) => {
    if (active) {
      writeTourRuntimeState({ active: true, stepIndex: step })
    } else {
      writeTourRuntimeState(null)
    }
  }, [])

  React.useEffect(() => {
    if (!accessReady) return
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => setUserId("local-dev"))
      return
    }
    const client = getBrowserClient()
    if (!client) return
    let cancelled = false
    void client.auth.getUser().then(({ data }) => {
      if (!cancelled) setUserId(data.user?.id ?? "")
    })
    return () => {
      cancelled = true
    }
  }, [accessReady])

  const handleWelcomeConsumed = React.useCallback(() => {
    const id = businessId?.trim()
    const uid = userId.trim()
    if (id && uid) {
      markWelcomeHandledForBusiness(id, uid)
    } else {
      clearPanelAccessJustActivated()
    }
    setLegacyWelcomeDismissed()
    setWelcomeOpen(false)
  }, [businessId, userId])

  React.useEffect(() => {
    queueMicrotask(() => {
      setWelcomeOpen(false)
      if (isPublicTourBlockedPath(pathname)) {
        setTourActive(false)
        persistStep(false, 0)
      }
      setTourReady(true)
    })
  }, [pathname, persistStep])

  /** ?onboarding=welcome → marker sesji (np. link z activate-access). */
  React.useEffect(() => {
    if (typeof window === "undefined" || !accessReady) return
    const id = businessId?.trim()
    if (!id) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("onboarding") !== "welcome") return
    markPanelAccessJustActivated(id)
    params.delete("onboarding")
    const qs = params.toString()
    const next = `${pathname}${qs ? `?${qs}` : ""}`
    router.replace(next, { scroll: false })
  }, [accessReady, businessId, pathname, router])

  /** Welcome tylko: /dashboard + świeży marker aktywacji + trialing/active + nie obsłużono dla firmy. */
  React.useEffect(() => {
    if (!tourReady || !eligibilityReady || !panelOnboardingEligible) return
    if (tourActive || welcomeOpen) return
    const id = businessId?.trim()
    if (!id) return
    if (!isPanelWelcomePopupPath(pathname)) return
    const uid = userId.trim()
    if (uid && isWelcomeHandledForBusiness(id, uid)) {
      clearPanelAccessJustActivated()
      return
    }
    if (!hasPendingAccessActivationForBusiness(id)) return

    queueMicrotask(() => {
      setWelcomeOpen(true)
      clearPanelAccessJustActivated()
    })
  }, [
    tourReady,
    eligibilityReady,
    panelOnboardingEligible,
    tourActive,
    welcomeOpen,
    businessId,
    userId,
    pathname,
  ])

  React.useEffect(() => {
    if (!tourReady || !eligibilityReady) return
    if (panelOnboardingEligible) return
    setWelcomeOpen(false)
    if (tourActive) {
      setTourActive(false)
      persistStep(false, 0)
    }
  }, [
    tourReady,
    eligibilityReady,
    panelOnboardingEligible,
    tourActive,
    persistStep,
  ])

  React.useEffect(() => {
    if (!tourReady || !isPublicTourBlockedPath(pathname)) return
    setWelcomeOpen(false)
    if (tourActive) {
      setTourActive(false)
      persistStep(false, 0)
    }
  }, [pathname, tourReady, tourActive, persistStep])

  React.useEffect(() => {
    if (!tourActive) return
    const step = TOUR_STEPS[stepIndex]
    if (!step) return
    if (step.path !== pathname) {
      router.push(step.path)
    }
  }, [tourActive, stepIndex, pathname, router])

  React.useEffect(() => {
    if (!tourActive || !tourReady) return
    persistStep(true, stepIndex)
  }, [tourActive, tourReady, stepIndex, persistStep])

  const dismissWelcome = React.useCallback(() => {
    handleWelcomeConsumed()
  }, [handleWelcomeConsumed])

  const openWelcome = React.useCallback(() => {
    if (!panelOnboardingEligible) return
    setWelcomeOpen(true)
  }, [panelOnboardingEligible])

  const startTour = React.useCallback(
    (fromStepIndex = 0) => {
      if (!panelOnboardingEligible) return
      handleWelcomeConsumed()
      const next = Math.max(0, Math.min(fromStepIndex, TOUR_STEPS.length - 1))
      setStepIndex(next)
      setTourActive(true)
      const step = TOUR_STEPS[next]
      if (step && pathname !== step.path) {
        router.push(step.path)
      }
    },
    [pathname, router, panelOnboardingEligible, handleWelcomeConsumed]
  )

  const finishTourCompletely = React.useCallback(() => {
    setTourActive(false)
    persistStep(false, 0)
    try {
      window.localStorage.setItem(TOUR_KEYS.tourFinished, "1")
    } catch {
      /* ignore */
    }
    const id = businessId?.trim()
    const uid = userId.trim()
    if (id && uid) markWelcomeHandledForBusiness(id, uid)
    setLegacyWelcomeDismissed()
  }, [persistStep, businessId, userId])

  const nextStep = React.useCallback(() => {
    if (stepIndex >= TOUR_STEPS.length - 1) return
    setStepIndex((i) => i + 1)
  }, [stepIndex])

  const prevStep = React.useCallback(() => {
    if (stepIndex <= 0) return
    setStepIndex((i) => i - 1)
  }, [stepIndex])

  const skipTour = React.useCallback(() => {
    setTourActive(false)
    persistStep(false, 0)
    const id = businessId?.trim()
    const uid = userId.trim()
    if (id && uid) markWelcomeHandledForBusiness(id, uid)
    setLegacyWelcomeDismissed()
  }, [persistStep, businessId, userId])

  const finishTour = React.useCallback(() => {
    finishTourCompletely()
  }, [finishTourCompletely])

  const endTourEarly = React.useCallback(() => {
    finishTourCompletely()
  }, [finishTourCompletely])

  const value = React.useMemo<TourContextValue>(
    () => ({
      welcomeOpen,
      tourActive,
      stepIndex,
      tourReady,
      canShowOnboardingUi,
      openWelcome,
      dismissWelcome,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      finishTour,
      endTourEarly,
    }),
    [
      welcomeOpen,
      tourActive,
      stepIndex,
      tourReady,
      canShowOnboardingUi,
      openWelcome,
      dismissWelcome,
      startTour,
      nextStep,
      prevStep,
      skipTour,
      finishTour,
      endTourEarly,
    ]
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const ctx = React.useContext(TourContext)
  if (!ctx) {
    throw new Error("useTour must be used within TourProvider")
  }
  return ctx
}
