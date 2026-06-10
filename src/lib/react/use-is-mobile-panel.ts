"use client"

import * as React from "react"

/** Mobile panel shell: poniżej breakpointu `lg` (1024px). */
export function useIsMobilePanel(): boolean {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)")
    const apply = () => setIsMobile(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  return isMobile
}
