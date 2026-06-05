"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  detectAdminBusinessStepReady,
  fetchOnboardingProgress,
  type OnboardingProgressSnapshot,
} from "@/lib/onboarding/fetch-onboarding-progress"
import { buildOnboardingScope } from "@/lib/onboarding/onboarding-scope"
import {
  persistOnboardingComplete,
  persistOnboardingRestart,
  persistOnboardingStepComplete,
  persistOnboardingWelcomeDismissed,
} from "@/lib/onboarding/persist-member-onboarding"
import {
  consumeOnboardingRestart,
  isOnboardingMarkedComplete,
  isOnboardingWelcomeDismissed,
  requestOnboardingRestart,
} from "@/lib/onboarding/onboarding-storage"
import {
  emptyOnboardingProgress,
  firstIncompleteStepId,
  getStepConfig,
  isOnboardingFullyComplete,
  type OnboardingStepId,
  type StaffOnboardingStepId,
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
  startSetupFromBeginning: () => void
  restartOnboarding: () => void
  refreshProgress: () => Promise<void>
  skipForNow: () => void
  markActiveStepComplete: () => void
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null)

function isBusinessAdmin(access: ReturnType<typeof useBusinessAccess>): boolean {
  return access.isOwner || access.effectiveRole === "admin" || access.canManageSettings
}

const STAFF_PATH_STEP: ReadonlyArray<{ path: string; stepId: StaffOnboardingStepId }> = [
  { path: "/dashboard", stepId: "staff_day_plan" },
  { path: "/appointments", stepId: "staff_appointments" },
  { path: "/schedule", stepId: "staff_schedule" },
  { path: "/messages", stepId: "staff_messages" },
  { path: "/guide", stepId: "staff_guide" },
]

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const access = useBusinessAccess()

  const [ready, setReady] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [userId, setUserId] = React.useState("")
  const [snapshot, setSnapshot] = React.useState<OnboardingProgressSnapshot | null>(null)
  const [welcomeOpen, setWelcomeOpen] = React.useState(false)
  const [flowActive, setFlowActive] = React.useState(false)
  const [activeStepId, setActiveStepId] = React.useState<OnboardingStepId | null>(null)

  const { ready: eligibilityReady, eligible: panelEligible } = usePanelOnboardingEligibility(flowActive)
  const isAdmin = isBusinessAdmin(access)
  const eligible = panelEligible
  const businessId = access.businessId?.trim() ?? ""

  const scope = React.useMemo(
    () => buildOnboardingScope(userId, businessId, isAdmin),
    [userId, businessId, isAdmin],
  )

  React.useEffect(() => {
    if (!access.ready) return
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
  }, [access.ready])

  const finishOnboardingFlow = React.useCallback(async () => {
    const client = getBrowserClient()
    if (scope) {
      await persistOnboardingComplete(client, scope)
      if (userId) markWelcomeHandledForBusiness(businessId, userId)
    }
    setFlowActive(false)
    setActiveStepId(null)
    setWelcomeOpen(false)
  }, [scope, userId, businessId])

  const refreshProgress = React.useCallback(async () => {
    if (!businessId || !scope) {
      setSnapshot(null)
      setLoading(false)
      return
    }
    if (!isSupabaseConfigured()) {
      setSnapshot({
        progress: emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"],
        slug: null,
        bookingPath: null,
        userFlags: { welcomeDismissed: false, completed: false },
      })
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
      let fetched = await fetchOnboardingProgress(client, businessId, {
        isAdmin,
        userId: scope.userId,
      })

      if (flowActive && isAdmin && activeStepId) {
        const ready = await detectAdminBusinessStepReady(client, businessId, activeStepId)
        if (ready) {
          await persistOnboardingStepComplete(client, scope, activeStepId)
          fetched = {
            ...fetched,
            progress: { ...fetched.progress, [activeStepId]: true },
          }
        }
      }

      setSnapshot(fetched)
      setLoading(false)

      if (flowActive && isOnboardingFullyComplete(fetched.progress, isAdmin)) {
        await finishOnboardingFlow()
      }
    } catch {
      setSnapshot({
        progress: emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"],
        slug: null,
        bookingPath: null,
        userFlags: { welcomeDismissed: false, completed: false },
      })
      setLoading(false)
    }
  }, [businessId, scope, isAdmin, flowActive, activeStepId, finishOnboardingFlow])

  React.useEffect(() => {
    queueMicrotask(() => setReady(true))
  }, [])

  React.useEffect(() => {
    if (!access.ready || !eligible || !scope) {
      queueMicrotask(() => setLoading(false))
      return
    }
    queueMicrotask(() => {
      setLoading(true)
      void refreshProgress()
    })
  }, [access.ready, eligible, scope, refreshProgress])

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
      const next = firstIncompleteStepId(snapshot.progress, isAdmin)
      if (!next) {
        queueMicrotask(() => {
          void finishOnboardingFlow()
        })
        return
      }
      queueMicrotask(() => setActiveStepId(next))
      const step = getStepConfig(next)
      const href = step.path
      const needsNavigation = !pathname.startsWith(step.path)
      if (isAdmin && next === "booking_page" && snapshot.bookingPath) {
        window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        if (needsNavigation) router.push(href)
        return
      }
      if (needsNavigation) router.push(href)
    }
  }, [flowActive, snapshot, activeStepId, pathname, router, isAdmin, finishOnboardingFlow])

  React.useEffect(() => {
    if (typeof window === "undefined" || !access.ready || !businessId) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("onboarding") !== "welcome") return
    markPanelAccessJustActivated(businessId)
    params.delete("onboarding")
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
  }, [access.ready, businessId, pathname, router])

  React.useEffect(() => {
    if (!ready || !eligibilityReady || !eligible || !scope) return
    if (welcomeOpen || flowActive) return
    if (!isPanelWelcomePopupPath(pathname)) return
    if (loading) return

    const restart = consumeOnboardingRestart(scope)
    const pendingActivation = hasPendingAccessActivationForBusiness(businessId)
    const markedComplete =
      snapshot?.userFlags.completed ||
      isOnboardingMarkedComplete(scope)
    const dismissed =
      snapshot?.userFlags.welcomeDismissed ||
      isOnboardingWelcomeDismissed(scope)
    const dataComplete = snapshot ? isOnboardingFullyComplete(snapshot.progress, isAdmin) : false

    if (restart || pendingActivation) {
      if (pendingActivation && dismissed) {
        if (userId) markWelcomeHandledForBusiness(businessId, userId)
        return
      }
      if (pendingActivation && (dataComplete || markedComplete)) {
        if (userId) markWelcomeHandledForBusiness(businessId, userId)
        return
      }

      queueMicrotask(() => {
        clearPanelAccessJustActivated()
        setWelcomeOpen(true)
      })
      return
    }

    if (dataComplete || markedComplete) return

    if (!dismissed) {
      queueMicrotask(() => setWelcomeOpen(true))
    }
  }, [
    ready,
    eligibilityReady,
    eligible,
    scope,
    businessId,
    userId,
    welcomeOpen,
    flowActive,
    loading,
    pathname,
    snapshot,
    isAdmin,
  ])

  const markStep = React.useCallback(
    async (stepId: OnboardingStepId) => {
      if (!scope) return
      const client = getBrowserClient()
      await persistOnboardingStepComplete(client, scope, stepId)
      setSnapshot((prev) =>
        prev
          ? {
              ...prev,
              progress: { ...prev.progress, [stepId]: true },
            }
          : prev,
      )
    },
    [scope],
  )

  React.useEffect(() => {
    if (!flowActive || !scope || isAdmin) return
    for (const { path, stepId } of STAFF_PATH_STEP) {
      if (!pathname.startsWith(path)) continue
      void markStep(stepId)
      if (stepId === "staff_appointments" && pathname.startsWith("/appointments")) {
        void markStep("staff_first_visit")
      }
      break
    }
  }, [pathname, flowActive, scope, isAdmin, markStep])

  const dismissWelcome = React.useCallback(() => {
    clearPanelAccessJustActivated()
    if (scope) {
      const client = getBrowserClient()
      void persistOnboardingWelcomeDismissed(client, scope)
      if (userId) markWelcomeHandledForBusiness(businessId, userId)
    }
    setWelcomeOpen(false)
  }, [scope, userId, businessId])

  const skipForNow = React.useCallback(() => {
    dismissWelcome()
    setFlowActive(false)
    setActiveStepId(null)
  }, [dismissWelcome])

  const markActiveStepComplete = React.useCallback(() => {
    if (!activeStepId) return
    void markStep(activeStepId)
  }, [activeStepId, markStep])

  const navigateToStep = React.useCallback(
    (stepId: OnboardingStepId) => {
      const step = getStepConfig(stepId)
      const href = step.path
      const needsNavigation = !pathname.startsWith(step.path)
      setActiveStepId(stepId)
      setFlowActive(true)
      setWelcomeOpen(false)
      if (scope) {
        const client = getBrowserClient()
        void persistOnboardingWelcomeDismissed(client, scope)
      }

      if (isAdmin && stepId === "booking_page" && snapshot?.bookingPath) {
        void markStep("booking_page")
        window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        if (needsNavigation) router.push(href)
        return
      }
      if (isAdmin && stepId === "first_visit" && snapshot?.bookingPath) {
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
    [scope, isAdmin, pathname, router, snapshot, markStep],
  )

  const continueSetup = React.useCallback(() => {
    if (!snapshot) {
      void refreshProgress()
      setFlowActive(true)
      setWelcomeOpen(false)
      if (scope) {
        const client = getBrowserClient()
        void persistOnboardingWelcomeDismissed(client, scope)
      }
      router.push(isAdmin ? "/availability" : "/dashboard")
      return
    }
    const next = firstIncompleteStepId(snapshot.progress, isAdmin)
    if (!next) {
      void finishOnboardingFlow()
      return
    }
    navigateToStep(next)
  }, [snapshot, refreshProgress, scope, navigateToStep, router, isAdmin, finishOnboardingFlow])

  const startSetupFromBeginning = React.useCallback(() => {
    const first = isAdmin ? "working_hours" : "staff_day_plan"
    navigateToStep(first)
  }, [navigateToStep, isAdmin])

  const restartOnboarding = React.useCallback(() => {
    if (!scope) return
    requestOnboardingRestart(scope)
    const client = getBrowserClient()
    void persistOnboardingRestart(client, scope)
    setWelcomeOpen(true)
    setFlowActive(false)
    setActiveStepId(null)
    void refreshProgress()
    if (pathname !== "/dashboard") router.push("/dashboard")
  }, [scope, refreshProgress, pathname, router])

  const setupComplete = Boolean(
    scope &&
      (snapshot?.userFlags.completed ||
        isOnboardingMarkedComplete(scope) ||
        Boolean(snapshot && isOnboardingFullyComplete(snapshot.progress, isAdmin))),
  )
  const welcomeDismissed = Boolean(
    scope &&
      (snapshot?.userFlags.welcomeDismissed || isOnboardingWelcomeDismissed(scope)),
  )

  const showDashboardCard =
    eligible && Boolean(scope) && !welcomeDismissed && !setupComplete

  const value = React.useMemo<OnboardingContextValue>(
    () => ({
      ready,
      eligible,
      isAdmin,
      loading,
      snapshot,
      welcomeOpen,
      flowActive,
      activeStepId,
      showDashboardCard,
      setupComplete,
      dismissWelcome,
      continueSetup,
      startSetupFromBeginning,
      restartOnboarding,
      refreshProgress,
      skipForNow,
      markActiveStepComplete,
    }),
    [
      ready,
      eligible,
      isAdmin,
      loading,
      snapshot,
      welcomeOpen,
      flowActive,
      activeStepId,
      showDashboardCard,
      setupComplete,
      dismissWelcome,
      continueSetup,
      startSetupFromBeginning,
      restartOnboarding,
      refreshProgress,
      skipForNow,
      markActiveStepComplete,
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
