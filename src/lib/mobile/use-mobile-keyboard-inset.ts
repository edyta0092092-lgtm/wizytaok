"use client"

import * as React from "react"

/** Wysokość nachodzącej klawiatury (px) — do podnoszenia sticky footers nad klawiaturą. */
export function useMobileKeyboardInset(enabled = true): number {
  const [inset, setInset] = React.useState(0)

  React.useEffect(() => {
    if (!enabled || typeof window === "undefined") return
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setInset(Math.round(overlap))
    }

    vv.addEventListener("resize", update)
    vv.addEventListener("scroll", update)
    update()
    return () => {
      vv.removeEventListener("resize", update)
      vv.removeEventListener("scroll", update)
    }
  }, [enabled])

  return inset
}
