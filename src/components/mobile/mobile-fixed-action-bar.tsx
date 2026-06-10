"use client"

import * as React from "react"

import { useMobileKeyboardInset } from "@/lib/mobile/use-mobile-keyboard-inset"
import { cn } from "@/lib/utils"

type MobileFixedActionBarProps = {
  children: React.ReactNode
  className?: string
}

/** Sticky pasek akcji nad bottom nav + safe area; podnosi się nad klawiaturą. */
export function MobileFixedActionBar({ children, className }: MobileFixedActionBarProps) {
  const keyboardInset = useMobileKeyboardInset()

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden",
        className,
      )}
      style={{
        bottom: `calc(var(--mobile-bottom-stack-height, calc(3.5rem + env(safe-area-inset-bottom, 0px))) + ${keyboardInset}px)`,
      }}
    >
      {children}
    </div>
  )
}
