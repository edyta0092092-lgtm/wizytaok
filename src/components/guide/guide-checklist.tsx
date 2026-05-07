"use client"

import type { ReactNode } from "react"

type GuideChecklistProps = {
  children: ReactNode
  className?: string
}

export function GuideChecklist({
  children,
  className = "grid gap-4 lg:grid-cols-2",
}: GuideChecklistProps) {
  return <section className={className}>{children}</section>
}
