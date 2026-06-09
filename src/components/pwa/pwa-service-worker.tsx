"use client"

import * as React from "react"

/** Rejestruje lekki SW (bez cache) — tylko po stronie klienta. */
export function PwaServiceWorker() {
  React.useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // MVP: brak throw — PWA nadal działa z manifestem (np. iOS)
    })
  }, [])

  return null
}
