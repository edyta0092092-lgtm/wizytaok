"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/** Na desktopie podstrony ustawień przekierowują do głównej listy. */
export function SettingsDesktopRedirect() {
  const router = useRouter()

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const mq = window.matchMedia("(min-width: 1024px)")
    const go = () => {
      if (mq.matches) router.replace("/settings")
    }
    go()
    mq.addEventListener("change", go)
    return () => mq.removeEventListener("change", go)
  }, [router])

  return null
}
