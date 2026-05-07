"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { TOUR_STEPS } from "@/lib/guide/tour-steps"
import {
  TOUR_KEYS,
  readTourRuntimeState,
  writeTourRuntimeState,
} from "@/lib/tour/tour-storage"

function getFromStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function setInStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

type TourContextValue = {
  welcomeOpen: boolean
  tourActive: boolean
  stepIndex: number
  tourReady: boolean
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

  const [tourReady, setTourReady] = React.useState(false)
  const [welcomeOpen, setWelcomeOpen] = React.useState(false)
  const [tourActive, setTourActive] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)

  const persistStep = React.useCallback((active: boolean, step: number) => {
    if (active) {
      writeTourRuntimeState({ active: true, stepIndex: step })
    } else {
      writeTourRuntimeState(null)
    }
  }, [])

  React.useEffect(() => {
    const dismissed = getFromStorage(TOUR_KEYS.welcomeDismissed)
    const finishedTour = getFromStorage(TOUR_KEYS.tourFinished)
    const runtime = readTourRuntimeState()

    queueMicrotask(() => {
      if (runtime?.active) {
        const idx = Math.min(
          Math.max(0, runtime.stepIndex),
          TOUR_STEPS.length - 1
        )
        setStepIndex(idx)
        setTourActive(true)
        setWelcomeOpen(false)
        setTourReady(true)
        return
      }

      if (finishedTour === "1" || dismissed === "1") {
        setWelcomeOpen(false)
      } else {
        setWelcomeOpen(true)
      }
      setTourReady(true)
    })
  }, [])

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
    setInStorage(TOUR_KEYS.welcomeDismissed, "1")
    setWelcomeOpen(false)
  }, [])

  const openWelcome = React.useCallback(() => {
    setWelcomeOpen(true)
  }, [])

  const startTour = React.useCallback(
    (fromStepIndex = 0) => {
      setInStorage(TOUR_KEYS.welcomeDismissed, "1")
      setWelcomeOpen(false)
      const next = Math.max(0, Math.min(fromStepIndex, TOUR_STEPS.length - 1))
      setStepIndex(next)
      setTourActive(true)
      const step = TOUR_STEPS[next]
      if (step && pathname !== step.path) {
        router.push(step.path)
      }
    },
    [pathname, router]
  )

  const finishTourCompletely = React.useCallback(() => {
    setTourActive(false)
    persistStep(false, 0)
    setInStorage(TOUR_KEYS.tourFinished, "1")
    setInStorage(TOUR_KEYS.welcomeDismissed, "1")
  }, [persistStep])

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
    setInStorage(TOUR_KEYS.welcomeDismissed, "1")
  }, [persistStep])

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
