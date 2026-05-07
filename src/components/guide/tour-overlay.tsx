"use client"

import * as React from "react"

export type TourOverlayRect = {
  top: number
  left: number
  width: number
  height: number
}

type TourOverlayProps = {
  rect: TourOverlayRect | null
}

/**
 * Cztery ćwiartki przyciemnienia + obwódka wokół podświetlonego prostokąta.
 */
export function TourOverlay({ rect }: TourOverlayProps) {
  if (!rect) {
    return (
      <div
        className="fixed inset-0 z-[199] bg-black/45 backdrop-blur-[1px] dark:bg-black/55 pointer-events-none"
        aria-hidden
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[199] pointer-events-none" aria-hidden>
      <div
        className="absolute bg-black/45 dark:bg-black/55 pointer-events-none"
        style={{
          top: 0,
          left: 0,
          right: 0,
          height: rect.top,
        }}
      />
      <div
        className="absolute bg-black/45 dark:bg-black/55 pointer-events-none"
        style={{
          top: rect.top + rect.height,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      <div
        className="absolute bg-black/45 dark:bg-black/55 pointer-events-none"
        style={{
          top: rect.top,
          left: 0,
          width: rect.left,
          height: rect.height,
        }}
      />
      <div
        className="absolute bg-black/45 dark:bg-black/55 pointer-events-none"
        style={{
          top: rect.top,
          left: rect.left + rect.width,
          right: 0,
          height: rect.height,
        }}
      />
      <div
        className="absolute rounded-2xl border-2 border-primary bg-transparent shadow-[0_0_0_4px_rgb(255_255_255/0.1)] ring-2 ring-primary/35 dark:shadow-[0_0_0_4px_rgb(255_255_255/0.05)] pointer-events-none"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
    </div>
  )
}
