"use client"

import * as React from "react"

const CSS_VAR = "--mobile-bottom-stack-height"
const FALLBACK = "calc(3.5rem + env(safe-area-inset-bottom, 0px))"

/** Mierzy stały dolny pasek (PWA banner + bottom nav) i zapisuje w CSS variable. */
export function useMobileBottomStackHeight(ref: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const el = ref.current
    if (!el) return

    const apply = () => {
      const h = el.getBoundingClientRect().height
      document.documentElement.style.setProperty(CSS_VAR, `${Math.ceil(h)}px`)
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)

    const onLayoutChange = () => apply()
    window.addEventListener("pw-layout-change", onLayoutChange)

    return () => {
      ro.disconnect()
      window.removeEventListener("pw-layout-change", onLayoutChange)
      document.documentElement.style.setProperty(CSS_VAR, FALLBACK)
    }
  }, [ref])
}
