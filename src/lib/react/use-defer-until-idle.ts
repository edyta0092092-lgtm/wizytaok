"use client"

import * as React from "react"

/**
 * Ustawia `true` po pierwszym idle callbacku (albo po krótkim timeout).
 * Służy do odłożenia mountu ciężkich komponentów UI (tour, help) po pierwszym malowaniu.
 */
export function useDeferUntilIdle(timeoutMs = 450): boolean {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    const done = () => {
      if (!cancelled) setReady(true)
    }
    if (typeof window === "undefined") return
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(done, { timeout: timeoutMs })
      return () => {
        cancelled = true
        window.cancelIdleCallback(id)
      }
    }
    const tid = window.setTimeout(done, Math.min(220, timeoutMs))
    return () => {
      cancelled = true
      window.clearTimeout(tid)
    }
  }, [timeoutMs])
  return ready
}
