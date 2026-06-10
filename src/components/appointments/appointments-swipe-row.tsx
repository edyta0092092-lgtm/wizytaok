"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type AppointmentsSwipeRowProps = {
  children: React.ReactNode
  rightActionLabel: string
  leftActionLabel: string
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  disabled?: boolean
}

const SWIPE_THRESHOLD = 64
const MAX_OFFSET = 96

export function AppointmentsSwipeRow({
  children,
  rightActionLabel,
  leftActionLabel,
  onSwipeRight,
  onSwipeLeft,
  disabled = false,
}: AppointmentsSwipeRowProps) {
  const [offset, setOffset] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const draggingRef = React.useRef(false)
  const startXRef = React.useRef(0)
  const offsetRef = React.useRef(0)

  const reset = React.useCallback(() => {
    draggingRef.current = false
    setDragging(false)
    setOffset(0)
    offsetRef.current = 0
  }, [])

  const onTouchStart = (event: React.TouchEvent) => {
    if (disabled) return
    draggingRef.current = true
    setDragging(true)
    startXRef.current = event.touches[0]?.clientX ?? 0
  }

  const onTouchMove = (event: React.TouchEvent) => {
    if (!draggingRef.current || disabled) return
    const currentX = event.touches[0]?.clientX ?? 0
    const delta = currentX - startXRef.current
    const clamped = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, delta))
    offsetRef.current = clamped
    setOffset(clamped)
  }

  const onTouchEnd = () => {
    if (!draggingRef.current || disabled) return
    const finalOffset = offsetRef.current
    if (finalOffset >= SWIPE_THRESHOLD) onSwipeRight?.()
    else if (finalOffset <= -SWIPE_THRESHOLD) onSwipeLeft?.()
    reset()
  }

  const showRight = offset > 8 && Boolean(onSwipeRight)
  const showLeft = offset < -8 && Boolean(onSwipeLeft)

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {onSwipeRight ? (
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-emerald-600 text-sm font-semibold text-white transition-opacity",
            showRight ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        >
          {rightActionLabel}
        </div>
      ) : null}
      {onSwipeLeft ? (
        <div
          className={cn(
            "absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-destructive text-sm font-semibold text-destructive-foreground transition-opacity",
            showLeft ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        >
          {leftActionLabel}
        </div>
      ) : null}
      <div
        className="relative touch-pan-y"
        style={{
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: dragging ? "none" : "transform 180ms ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={reset}
      >
        {children}
      </div>
    </div>
  )
}
