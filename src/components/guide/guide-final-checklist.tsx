"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

const STORAGE_KEY = "pw_guide_whats_next_checks"

type Item = {
  id: string
  label: string
}

type GuideFinalChecklistProps = {
  title: string
  subtitle?: string
  items: readonly Item[]
}

function loadStored(): Record<string, boolean> {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== "object") return {}
    return p as Record<string, boolean>
  } catch {
    return {}
  }
}

function saveStored(next: Record<string, boolean>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

export function GuideFinalChecklist({
  title,
  subtitle,
  items,
}: GuideFinalChecklistProps) {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    queueMicrotask(() => setChecked(loadStored()))
  }, [])

  const toggle = React.useCallback((id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      saveStored(next)
      return next
    })
  }, [])

  return (
    <section className="rounded-3xl border border-border/70 bg-muted/25 p-5 sm:p-7 dark:bg-muted/15">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2" role="list">
        {items.map((item) => {
          const isOn = checked[item.id] === true
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex min-h-14 w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors sm:min-h-0",
                  isOn
                    ? "border-primary/35 bg-[color:var(--nav-active-bg)] text-foreground dark:border-primary/40"
                    : "border-border/70 bg-card/70 text-foreground hover:border-border dark:bg-card/40"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px]",
                    isOn
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-transparent"
                  )}
                  aria-hidden
                >
                  <Check className="size-3" />
                </span>
                <span className="text-pretty leading-snug">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
