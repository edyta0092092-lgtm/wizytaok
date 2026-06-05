"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { useBusinessAccess } from "@/lib/auth/business-access-context"
import {
  fetchOnboardingProgress,
  panelStateToSnapshot,
  type OnboardingProgressSnapshot,
} from "@/lib/onboarding/fetch-onboarding-progress"
import {
  emptyMemberOnboardingRecord,
  type MemberOnboardingRecord,
} from "@/lib/onboarding/member-onboarding-db"
import { buildOnboardingScope } from "@/lib/onboarding/onboarding-scope"
import {
  consumeOnboardingRestartPending,
  persistOnboardingComplete,
  persistOnboardingResumeStep,
  persistOnboardingResetProgress,
  persistOnboardingRestartRequest,
  persistOnboardingStepComplete,
  persistOnboardingWelcomeDismissed,
  recordToFlags,
} from "@/lib/onboarding/persist-member-onboarding"
import { syncOnboardingStepsFromBusiness } from "@/lib/onboarding/sync-business-onboarding-steps"
import {
  emptyOnboardingProgress,
  firstIncompleteStepId,
  getOnboardingStepIds,
  getStepConfig,
  isOnboardingFullyComplete,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import {
  readOnboardingUrlAction,
  stripOnboardingSearchParam,
} from "@/lib/onboarding/onboarding-url-params"
import {
  clearPanelAccessJustActivated,
  hasPendingAccessActivationForBusiness,
  markPanelAccessJustActivated,
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
  advanceFlowStep: () => Promise<void>
  jumpToStep: (stepId: OnboardingStepId) => void
}

const OnboardingContext = React.createContext<OnboardingContextValue | null>(null)

function isBusinessAdmin(access: ReturnType<typeof useBusinessAccess>): boolean {
  return access.isOwner || access.effectiveRole === "admin" || access.canManageSettings
}

function scopeKey(scope: { userId: string; businessId: string; track: string }): string {
  return `${scope.userId}:${scope.businessId}:${scope.track}`
}

function resolveContinueStepId(
  progress: OnboardingProgressSnapshot["progress"],
  record: MemberOnboardingRecord,
  isAdmin: boolean,
): OnboardingStepId {
  const resume = record.meta.resumeStepId
  if (resume && !progress[resume]) return resume
  const next = firstIncompleteStepId(progress, isAdmin)
  if (next) return next
  return getOnboardingStepIds(isAdmin)[0]!
}

function eventStepsForSync(
  eventName: string,
  isAdmin: boolean,
): OnboardingStepId[] | null {
  switch (eventName) {
    case "pw-bookings":
      return isAdmin
        ? ["first_visit"]
        : ["staff_appointments", "staff_first_visit", "staff_schedule"]
    case "pw-services":
      return isAdmin ? ["service"] : null
    case "pw-staff":
      return isAdmin ? ["team_member", "staff_service"] : null
    case "pw-staff-services-saved":
      return isAdmin ? ["staff_service"] : null
    case "pw-availability":
      return isAdmin ? ["working_hours"] : null
    default:
      return null
  }
}

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

  const recordRef = React.useRef<MemberOnboardingRecord>(emptyMemberOnboardingRecord())
  const businessSyncedKeyRef = React.useRef<string | null>(null)
  const syncDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingResumeFromUrlRef = React.useRef(false)

  const { ready: eligibilityReady, eligible: panelEligible } = usePanelOnboardingEligibility(flowActive)
  const isAdmin = isBusinessAdmin(access)
  const eligible = panelEligible
  const businessId = access.businessId?.trim() ?? ""

  const scope = React.useMemo(
    () => buildOnboardingScope(userId, businessId, isAdmin),
    [userId, businessId, isAdmin],
  )

  const applyRecord = React.useCallback(
    (record: MemberOnboardingRecord) => {
      recordRef.current = record
      setSnapshot((prev) => {
        const panel = {
          record,
          slug: prev?.slug ?? null,
          bookingPath: prev?.bookingPath ?? null,
        }
        return panelStateToSnapshot(panel, isAdmin)
      })
    },
    [isAdmin],
  )

  const applySnapshot = React.useCallback((snap: OnboardingProgressSnapshot) => {
    recordRef.current = snap.record
    setSnapshot(snap)
  }, [])

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

  React.useEffect(() => {
    if (!scope) return
    businessSyncedKeyRef.current = null
    recordRef.current = emptyMemberOnboardingRecord()
  }, [scope?.userId, scope?.businessId, scope?.track])

  const finishOnboardingFlow = React.useCallback(async () => {
    const client = getBrowserClient()
    if (scope) {
      const next = await persistOnboardingComplete(client, scope, recordRef.current)
      applyRecord(next)
    }
    setFlowActive(false)
    setActiveStepId(null)
    setWelcomeOpen(false)
  }, [scope, applyRecord])

  const reloadFromDb = React.useCallback(async () => {
    if (!businessId || !scope) {
      setSnapshot(null)
      setLoading(false)
      return
    }
    if (!isSupabaseConfigured()) {
      const empty = emptyMemberOnboardingRecord()
      recordRef.current = empty
      setSnapshot({
        progress: emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"],
        slug: null,
        bookingPath: null,
        userFlags: recordToFlags(empty),
        record: empty,
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
      const fetched = await fetchOnboardingProgress(client, businessId, {
        isAdmin,
        userId: scope.userId,
      })
      applySnapshot(fetched)

      if (fetched.userFlags.restartPending) {
        const { record } = await consumeOnboardingRestartPending(
          client,
          scope,
          fetched.record,
        )
        applyRecord(record)
      }

      setLoading(false)

      if (flowActive && isOnboardingFullyComplete(fetched.progress, isAdmin)) {
        await finishOnboardingFlow()
      }
    } catch {
      const empty = emptyMemberOnboardingRecord()
      recordRef.current = empty
      setSnapshot({
        progress: emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"],
        slug: null,
        bookingPath: null,
        userFlags: recordToFlags(empty),
        record: empty,
      })
      setLoading(false)
    }
  }, [businessId, scope, isAdmin, flowActive, finishOnboardingFlow, applySnapshot, applyRecord])

  const syncBusinessSteps = React.useCallback(
    async (onlyStepIds?: OnboardingStepId[]) => {
      if (!businessId || !scope || !isSupabaseConfigured()) return
      const client = getBrowserClient()
      if (!client) return
      const next = await syncOnboardingStepsFromBusiness(
        client,
        businessId,
        scope,
        recordRef.current,
        onlyStepIds,
      )
      applyRecord(next)
    },
    [businessId, scope, applyRecord],
  )

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
      void reloadFromDb()
    })
  }, [access.ready, eligible, scope, reloadFromDb])

  React.useEffect(() => {
    if (!scope || !snapshot || loading) return
    const key = scopeKey(scope)
    if (businessSyncedKeyRef.current === key) return
    businessSyncedKeyRef.current = key

    const incomplete = getOnboardingStepIds(isAdmin).filter((id) => !recordRef.current.steps[id])
    if (incomplete.length === 0) return
    void syncBusinessSteps(incomplete)
  }, [scope, snapshot, loading, isAdmin, syncBusinessSteps])

  React.useEffect(() => {
    if (typeof window === "undefined" || !access.ready || !businessId) return
    const action = readOnboardingUrlAction()
    if (!action) return

    if (action === "welcome") {
      markPanelAccessJustActivated(businessId)
    }
    if (action === "resume") {
      pendingResumeFromUrlRef.current = true
    }

    router.replace(
      stripOnboardingSearchParam(pathname, window.location.search),
      { scroll: false },
    )
  }, [access.ready, businessId, pathname, router])

  const setupComplete = Boolean(
    snapshot?.userFlags.completed ||
      Boolean(snapshot && isOnboardingFullyComplete(snapshot.progress, isAdmin)),
  )

  React.useEffect(() => {
    if (!ready || !eligibilityReady || !eligible || !scope) return
    if (welcomeOpen || flowActive) return
    if (!isPanelWelcomePopupPath(pathname)) return
    if (loading) return
    if (pendingResumeFromUrlRef.current) return

    const pendingActivation = hasPendingAccessActivationForBusiness(businessId)
    const markedComplete = snapshot?.userFlags.completed ?? false
    const dataComplete = snapshot ? isOnboardingFullyComplete(snapshot.progress, isAdmin) : false
    const restartPending = snapshot?.userFlags.restartPending ?? false

    if (dataComplete || markedComplete) return

    if (restartPending || pendingActivation) {
      if (pendingActivation && (dataComplete || markedComplete)) {
        clearPanelAccessJustActivated()
        return
      }

      queueMicrotask(() => {
        if (pendingActivation) clearPanelAccessJustActivated()
        setWelcomeOpen(true)
      })
    }
  }, [
    ready,
    eligibilityReady,
    eligible,
    scope,
    businessId,
    welcomeOpen,
    flowActive,
    loading,
    pathname,
    snapshot,
    isAdmin,
  ])

  const persistResume = React.useCallback(
    (stepId: OnboardingStepId | null) => {
      if (!scope) return
      const client = getBrowserClient()
      void persistOnboardingResumeStep(client, scope, recordRef.current, stepId).then(applyRecord)
    },
    [scope, applyRecord],
  )

  const markStep = React.useCallback(
    async (stepId: OnboardingStepId): Promise<OnboardingProgressSnapshot["progress"] | null> => {
      if (!scope) return null
      const client = getBrowserClient()
      const next = await persistOnboardingStepComplete(
        client,
        scope,
        recordRef.current,
        stepId,
      )
      applyRecord(next)
      const progress = panelStateToSnapshot(
        {
          record: next,
          slug: snapshot?.slug ?? null,
          bookingPath: snapshot?.bookingPath ?? null,
        },
        isAdmin,
      ).progress
      return progress
    },
    [scope, applyRecord, snapshot?.slug, snapshot?.bookingPath, isAdmin],
  )

  const goToStep = React.useCallback(
    (stepId: OnboardingStepId, progress: OnboardingProgressSnapshot["progress"]) => {
      const step = getStepConfig(stepId)
      const href = step.path
      const needsNavigation = !pathname.startsWith(step.path)
      setActiveStepId(stepId)
      setFlowActive(true)
      setWelcomeOpen(false)
      persistResume(stepId)

      if (isAdmin && stepId === "booking_page" && snapshot?.bookingPath) {
        window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        if (needsNavigation) router.push(href)
        return
      }
      if (isAdmin && stepId === "first_visit" && snapshot?.bookingPath && !progress.first_visit) {
        window.open(snapshot.bookingPath, "_blank", "noopener,noreferrer")
        return
      }
      if (needsNavigation) router.push(href)
    },
    [isAdmin, pathname, router, snapshot?.bookingPath, persistResume],
  )

  const resumeOnboardingFlow = React.useCallback(async () => {
    setWelcomeOpen(false)
    clearPanelAccessJustActivated()

    let baseProgress =
      snapshot?.progress ?? (emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"])

    if (!snapshot) {
      await reloadFromDb()
      baseProgress = panelStateToSnapshot(
        {
          record: recordRef.current,
          slug: null,
          bookingPath: null,
        },
        isAdmin,
      ).progress
    }

    if (!firstIncompleteStepId(baseProgress, isAdmin)) {
      await finishOnboardingFlow()
      return
    }

    const target = resolveContinueStepId(baseProgress, recordRef.current, isAdmin)
    goToStep(target, baseProgress)
  }, [
    snapshot,
    isAdmin,
    reloadFromDb,
    finishOnboardingFlow,
    goToStep,
  ])

  React.useEffect(() => {
    if (!pendingResumeFromUrlRef.current) return
    if (!ready || !eligibilityReady || !eligible || !scope) return
    if (!isPanelWelcomePopupPath(pathname)) return
    if (loading || !snapshot) return

    pendingResumeFromUrlRef.current = false

    if (setupComplete) return

    queueMicrotask(() => {
      void resumeOnboardingFlow()
    })
  }, [
    ready,
    eligibilityReady,
    eligible,
    scope,
    pathname,
    loading,
    snapshot,
    setupComplete,
    resumeOnboardingFlow,
  ])

  const dismissWelcome = React.useCallback(() => {
    clearPanelAccessJustActivated()
    if (scope) {
      const client = getBrowserClient()
      void persistOnboardingWelcomeDismissed(client, scope, recordRef.current).then(applyRecord)
    }
    setWelcomeOpen(false)
  }, [scope, applyRecord])

  const skipForNow = React.useCallback(() => {
    dismissWelcome()
    setFlowActive(false)
    setActiveStepId(null)
    persistResume(null)
  }, [dismissWelcome, persistResume])

  const jumpToStep = React.useCallback(
    (stepId: OnboardingStepId) => {
      const progress =
        snapshot?.progress ?? (emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"])
      goToStep(stepId, progress)
    },
    [snapshot?.progress, isAdmin, goToStep],
  )

  React.useEffect(() => {
    if (!eligible || !scope) return

    const scheduleSync = (eventName: string) => {
      const steps = eventStepsForSync(eventName, isAdmin)
      if (!steps?.length) return
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current)
      syncDebounceRef.current = setTimeout(() => {
        void syncBusinessSteps(steps)
      }, 500)
    }

    const onBookings = () => scheduleSync("pw-bookings")
    const onServices = () => scheduleSync("pw-services")
    const onStaff = () => scheduleSync("pw-staff")
    const onAvailability = () => scheduleSync("pw-availability")
    const onStaffServicesSaved = () => {
      if (!isAdmin) return
      void markStep("staff_service")
    }

    window.addEventListener("pw-bookings", onBookings)
    window.addEventListener("pw-services", onServices)
    window.addEventListener("pw-staff", onStaff)
    window.addEventListener("pw-availability", onAvailability)
    window.addEventListener("pw-staff-services-saved", onStaffServicesSaved)

    return () => {
      if (syncDebounceRef.current) clearTimeout(syncDebounceRef.current)
      window.removeEventListener("pw-bookings", onBookings)
      window.removeEventListener("pw-services", onServices)
      window.removeEventListener("pw-staff", onStaff)
      window.removeEventListener("pw-availability", onAvailability)
      window.removeEventListener("pw-staff-services-saved", onStaffServicesSaved)
    }
  }, [eligible, scope, isAdmin, syncBusinessSteps, markStep])

  React.useEffect(() => {
    if (!scope || isAdmin) return
    if (!pathname.startsWith("/dashboard")) return
    void markStep("staff_day_plan")
  }, [pathname, scope, isAdmin, markStep])

  const markActiveStepComplete = React.useCallback(async () => {
    if (!activeStepId) return
    await markStep(activeStepId)
  }, [activeStepId, markStep])

  const advanceAfterStep = React.useCallback(
    async (progressOverride?: OnboardingProgressSnapshot["progress"]) => {
      const base = progressOverride ?? snapshot?.progress
      if (!base) return
      const next = firstIncompleteStepId(base, isAdmin)
      if (!next) {
        await finishOnboardingFlow()
        return
      }
      goToStep(next, base)
    },
    [snapshot?.progress, isAdmin, finishOnboardingFlow, goToStep],
  )

  const advanceFlowStep = React.useCallback(async () => {
    if (!activeStepId) return
    const steps: OnboardingStepId[] = [activeStepId]
    if (activeStepId === "staff_appointments") steps.push("staff_first_visit")
    await syncBusinessSteps(steps)
    const synced = panelStateToSnapshot(
      {
        record: recordRef.current,
        slug: snapshot?.slug ?? null,
        bookingPath: snapshot?.bookingPath ?? null,
      },
      isAdmin,
    ).progress
    if (synced[activeStepId]) {
      await advanceAfterStep(synced)
    }
  }, [
    activeStepId,
    syncBusinessSteps,
    snapshot?.slug,
    snapshot?.bookingPath,
    isAdmin,
    advanceAfterStep,
  ])

  const continueSetup = React.useCallback(async () => {
    if (flowActive && activeStepId && snapshot) {
      setWelcomeOpen(false)
      clearPanelAccessJustActivated()
      await syncBusinessSteps([activeStepId])
      const synced = panelStateToSnapshot(
        {
          record: recordRef.current,
          slug: snapshot.slug ?? null,
          bookingPath: snapshot.bookingPath ?? null,
        },
        isAdmin,
      ).progress
      if (synced[activeStepId]) {
        await advanceAfterStep(synced)
      }
      return
    }

    await resumeOnboardingFlow()
  }, [
    snapshot,
    isAdmin,
    flowActive,
    activeStepId,
    advanceAfterStep,
    syncBusinessSteps,
    resumeOnboardingFlow,
  ])

  const resetOnboardingProgress = React.useCallback(
    async (options?: { openWelcome?: boolean }) => {
      if (!scope) return
      const client = getBrowserClient()
      const first = getOnboardingStepIds(isAdmin)[0] ?? null
      const optimistic = emptyMemberOnboardingRecord()
      optimistic.meta.resumeStepId = first
      applyRecord(optimistic)
      setWelcomeOpen(false)
      setFlowActive(false)
      setActiveStepId(null)
      if (scope) businessSyncedKeyRef.current = scopeKey(scope)

      try {
        const next = options?.openWelcome
          ? await persistOnboardingRestartRequest(client, scope, recordRef.current)
          : await persistOnboardingResetProgress(client, scope, recordRef.current)
        applyRecord(next)
        if (options?.openWelcome) setWelcomeOpen(true)
      } catch {
        /* optimistic UI już pokazuje 0/6 */
      }
    },
    [scope, isAdmin, applyRecord],
  )

  const startSetupFromBeginning = React.useCallback(() => {
    void (async () => {
      await resetOnboardingProgress()
      const empty = emptyOnboardingProgress(isAdmin) as OnboardingProgressSnapshot["progress"]
      const first = getOnboardingStepIds(isAdmin)[0]
      if (first) goToStep(first, empty)
    })()
  }, [resetOnboardingProgress, isAdmin, goToStep])

  const restartOnboarding = React.useCallback(() => {
    void (async () => {
      await resetOnboardingProgress({ openWelcome: true })
      if (pathname !== "/dashboard") router.push("/dashboard")
    })()
  }, [resetOnboardingProgress, pathname, router])

  const showDashboardCard = eligible && Boolean(scope) && !setupComplete

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
      refreshProgress: reloadFromDb,
      skipForNow,
      markActiveStepComplete,
      advanceFlowStep,
      jumpToStep,
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
      reloadFromDb,
      skipForNow,
      markActiveStepComplete,
      advanceFlowStep,
      jumpToStep,
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
