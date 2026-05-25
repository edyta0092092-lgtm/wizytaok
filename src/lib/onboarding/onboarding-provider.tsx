"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { fetchOnboardingProgress, type OnboardingProgressSnapshot } from "@/lib/onboarding/fetch-onboarding-progress"
import {
  consumeOnboardingRestart,
  isOnboardingMarkedComplete,
  isOnboardingWelcomeDismissed,
  markOnboardingComplete,
  markOnboardingWelcomeDismissed,
  requestOnboardingRestart,
} from "@/lib/onboarding/onboarding-storage"
import {
  emptyOnboardingProgress,
  firstIncompleteStepId,
  getStepConfig,
  isOnboardingFullyComplete,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import {
  clearPanelAccessJustActivated,
  hasPendingAccessActivationForBusiness,
  markPanelAccessJustActivated,
  markWelcomeHandledForBusiness,
} from "@/lib/tour/tour-access-activation"
import { usePanelOnboardingEligibility } from "@/lib/tour/use-panel-onboarding-eligibility"
import { isPanelWelcomePopupPath } from "@/lib/tour/tour-path-guard"
import { getBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client"

type OnboardingContextValue = {
  ready: boolean
  eligible: boolean
  isAdmin: boolean
  loading: boolean
  snapshot: OnboardingProgressSnapshot | null
  welcomeOpen: boolean
  flowActive: boolean
  activeStepId: OnboardingStepId | null
  showDashboardCard: boolean
  setupComplete: boolean
  dismissWelcome: () => void
  continueSetup: () => void
  restartOnboarding: () => void
  refreshProgress: () => Promise<void>
  skipForNow: () => void
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null)

function isBusinessAdmin(access: ReturnType<typeof useBusinessAccess>): boolean {
  return access.isOwner || access.effectiveRole === "admin" || access.canManageSettings
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const access = useBusinessAccess()

  const [ready, setReady] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [snapshot, setSnapshot] = React.useState<OnboardingProgressSnapshot | null>(null)
  const [welcomeOpen, setWelcomeOpen] = React.useState(false)
  const [flowActive, setFlowActive] = React.useState(false)
  const [activeStepId, setActiveStepId] = React.useState<OnboardingStepId | null>(null)
  const [freshChecklistOpen, setFreshChecklistOpen] = React.useState(false)

  const { ready: eligibilityReady, eligible: panelEligible } = usePanelOnboardingEligibility(flowActive)
  const isAdmin = isBusinessAdmin(access)
  const eligible = panelEligible && isAdmin

  const businessId = access.businessId?.trim() ?? ""

  const refreshProgress = React.useCallback(async () => {
    if (!businessId || !isSupabaseConfigured()) {
      setSnapshot(null)
      setLoading(false)
      return
    }
    const client = getBrowserClient()
    if (!client) {
      setSnapshot(null)
      setLoading(false)
      return
    }
    try {
      const next = await fetchOnboardingProgress(client, businessId)
      setSnapshot(next)
      setLoading(false)
      if (flowActive && !freshChecklistOpen && isOnboardingFullyComplete(next.progress) && businessId) {
        markOnboardingComplete(businessId)
        markWelcomeHandledForBusiness(businessId)
        setFlowActive(false)
        setActiveStepId(null)
        setWelcomeOpen(false)
      }
    } catch {
      setSnapshot({
        progress: emptyOnboardingProgress(),
        slug: null,
        bookingPath: null,
      })
      setLoading(false)
    }
  }, [businessId, flowActive, freshChecklistOpen])

  React.useEffect(() => {
    queueMicrotask(() => setReady(true))
  }, [])

  React.useEffect(() => {
    if (!access.ready || !eligible) {
      queueMicrotask(() => setLoading(false))
      return
    }
    queueMicrotask(() => {
      setLoading(true)
      void refreshProgress()
    })
  }, [access.ready, eligible, businessId, refreshProgress])

  React.useEffect(() => {
    if (!flowActive || !eligible) return
    const id = window.setInterval(() => {
      void refreshProgress()
    }, 4000)
    const onDataChange = () => void refreshProgress()
    window.addEventListener("pw-bookings", onDataChange)
    window.addEventListener("pw-services", onDataChange)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("pw-bookings", onDataChange)
      window.removeEventListener("pw-services", onDataChange)
    }
  }, [flowActive, eligible, refreshProgress])

  React.useEffect(() => {
    if (!flowActive || !snapshot || !activeStepId) return
    if (snapshot.progress[activeStepId]) {
      const next = firstIncompleteStepId(snapshot.progress)
      if (!next) {
        queueMicrotask(() => {
          setFlowActive(false)
          setActiveStepId(null)
        })
        return
      }
      queueMicrotask(() => setActiveStepId(next))
      const step = getStepConfig(next)
      const href = step.path
      const needsNavigation = pathname !== step.path || href !== step.path
      if (next === "booking_page" && snapshot.bookingPath) {
        window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        if (needsNavigation) router.push(href)
        return
      }
      if (needsNavigation) router.push(href)
    }
  }, [flowActive, snapshot, activeStepId, pathname, router])

  /** ?onboarding=welcome/start po aktywacji dostępu */
  React.useEffect(() => {
    if (typeof window === "undefined" || !access.ready || !businessId) return
    const params = new URLSearchParams(window.location.search)
    const requestedOnboarding = params.get("onboarding")
    if (requestedOnboarding !== "welcome" && requestedOnboarding !== "start") return
    markPanelAccessJustActivated(businessId)
    params.delete("onboarding")
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }, [access.ready, businessId, pathname, router])

  React.useEffect(() => {
    if (!ready || !eligibilityReady || !eligible || !businessId) return
    if (welcomeOpen || flowActive) return
    const pendingActivation = hasPendingAccessActivationForBusiness(businessId)
    const workingHoursPath = getStepConfig("working_hours").path
    const canHandleActivationOnPath =
      pendingActivation && (pathname === workingHoursPath || isPanelWelcomePopupPath(pathname))
    if (!canHandleActivationOnPath && !isPanelWelcomePopupPath(pathname)) return
    if (loading) return

    const restart = consumeOnboardingRestart(businessId)
    const markedComplete = isOnboardingMarkedComplete(businessId)
    const dataComplete = snapshot ? isOnboardingFullyComplete(snapshot.progress) : false

    if (restart) {
      queueMicrotask(() => {
        clearPanelAccessJustActivated()
        setFreshChecklistOpen(true)
        setWelcomeOpen(true)
      })
      return
    }

    if (pendingActivation) {
      if (dataComplete || markedComplete) {
        markWelcomeHandledForBusiness(businessId)
        return
      }

      queueMicrotask(() => {
        clearPanelAccessJustActivated()
        markOnboardingWelcomeDismissed(businessId)
        setFreshChecklistOpen(true)
        setWelcomeOpen(false)
        setActiveStepId("working_hours")
        setFlowActive(true)
      })
      if (pathname !== workingHoursPath) router.push(workingHoursPath)
      return
    }

    const dismissed = isOnboardingWelcomeDismissed(businessId)

    if (dataComplete || markedComplete) return

    if (!dismissed) {
      queueMicrotask(() => {
        setFreshChecklistOpen(true)
        setWelcomeOpen(true)
      })
    }
  }, [
    ready,
    eligibilityReady,
    eligible,
    businessId,
    welcomeOpen,
    flowActive,
    loading,
    pathname,
    router,
    snapshot,
  ])

  const dismissWelcome = React.useCallback(() => {
    if (businessId) {
      markOnboardingWelcomeDismissed(businessId)
      markWelcomeHandledForBusiness(businessId)
    }
    setWelcomeOpen(false)
  }, [businessId])

  const skipForNow = React.useCallback(() => {
    dismissWelcome()
    setFlowActive(false)
    setActiveStepId(null)
    setFreshChecklistOpen(false)
  }, [dismissWelcome])

  const navigateToStep = React.useCallback(
    (stepId: OnboardingStepId) => {
      const step = getStepConfig(stepId)
      const href = step.path
      const needsNavigation = pathname !== step.path || href !== step.path
      setActiveStepId(stepId)
      setFlowActive(true)
      setWelcomeOpen(false)
      setFreshChecklistOpen(false)
      if (businessId) markOnboardingWelcomeDismissed(businessId)

      if (stepId === "booking_page" && snapshot?.bookingPath) {
        window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        if (needsNavigation) router.push(href)
        return
      }
      if (stepId === "first_visit" && snapshot?.bookingPath) {
        const useBooking = !snapshot.progress.first_visit
        if (useBooking) {
          window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        } else if (needsNavigation) {
          router.push(href)
        }
        return
      }
      if (needsNavigation) router.push(href)
    },
    [businessId, pathname, router, snapshot],
  )

  const continueSetup = React.useCallback(() => {
    if (freshChecklistOpen) {
      navigateToStep("working_hours")
      return
    }
    if (!snapshot) {
      void refreshProgress()
      setFlowActive(true)
      setWelcomeOpen(false)
      setFreshChecklistOpen(false)
      if (businessId) markOnboardingWelcomeDismissed(businessId)
      router.push("/availability")
      return
    }
    const next = firstIncompleteStepId(snapshot.progress)
    if (!next) {
      if (businessId) markOnboardingComplete(businessId)
      setWelcomeOpen(false)
      setFlowActive(false)
      return
    }
    navigateToStep(next)
  }, [freshChecklistOpen, snapshot, refreshProgress, businessId, navigateToStep, router])

  const restartOnboarding = React.useCallback(() => {
    if (!businessId) return
    requestOnboardingRestart(businessId)
    setWelcomeOpen(true)
    setFreshChecklistOpen(true)
    setFlowActive(false)
    setActiveStepId(null)
    void refreshProgress()
    if (pathname !== "/dashboard") router.push("/dashboard")
  }, [businessId, refreshProgress, pathname, router])

  const setupComplete =
    Boolean(businessId) &&
    (isOnboardingMarkedComplete(businessId) ||
      Boolean(snapshot && isOnboardingFullyComplete(snapshot.progress)))

  const displaySnapshot = React.useMemo<OnboardingProgressSnapshot | null>(() => {
    if (!freshChecklistOpen) return snapshot
    return {
      progress: emptyOnboardingProgress(),
      slug: snapshot?.slug ?? null,
      bookingPath: snapshot?.bookingPath ?? null,
    }
  }, [freshChecklistOpen, snapshot])

  const showDashboardCard =
    eligible &&
    Boolean(businessId) &&
    (freshChecklistOpen || !setupComplete)

  const value = React.useMemo<OnboardingContextValue>(
    () => ({
      ready,
      eligible,
      isAdmin,
      loading,
      snapshot: displaySnapshot,
      welcomeOpen,
      flowActive,
      activeStepId,
      showDashboardCard,
      setupComplete,
      dismissWelcome,
      continueSetup,
      restartOnboarding,
      refreshProgress,
      skipForNow,
    }),
    [
      ready,
      eligible,
      isAdmin,
      loading,
      displaySnapshot,
      welcomeOpen,
      flowActive,
      activeStepId,
      showDashboardCard,
      setupComplete,
      dismissWelcome,
      continueSetup,
      restartOnboarding,
      refreshProgress,
      skipForNow,
    ],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext)
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider")
  }
  return ctx
}
