"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Circle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  GUIDE_SETUP_STEP_IDS,
  type GuideSetupAutoProgress,
  type GuideSetupStepId,
} from "@/lib/guide/fetch-guide-setup"
import type { GuideSetupManual } from "@/lib/guide/guide-setup-storage"

export type GuideSetupProgressProps = {
  labels: Record<GuideSetupStepId, string>
  auto: GuideSetupAutoProgress
  manual: GuideSetupManual
  hrefForStep: (id: GuideSetupStepId) => string
  onSetManualOverride: (id: GuideSetupStepId, value: boolean | null) => void
  statusDetectedAutoLabel: string
  statusMarkedManualLabel: string
  statusUncheckedManualLabel: string
  statusNotCompletedLabel: string
  markDoneLabel: string
  undoLabel: string
  useAutomaticStatusLabel: string
  stepAriaLabel: (id: GuideSetupStepId, checked: boolean) => string
  stepNoteForStep: (id: GuideSetupStepId) => string | null
  title: string
  hint: string
  goLabel: string
  percentLabel: (n: number) => string
}

export function GuideSetupProgress({
  labels,
  auto,
  manual,
  hrefForStep,
  onSetManualOverride,
  statusDetectedAutoLabel,
  statusMarkedManualLabel,
  statusUncheckedManualLabel,
  statusNotCompletedLabel,
  markDoneLabel,
  undoLabel,
  useAutomaticStatusLabel,
  stepAriaLabel,
  stepNoteForStep,
  title,
  hint,
  goLabel,
  percentLabel,
}: GuideSetupProgressProps) {
  const manualOverrideFor = React.useCallback(
    (id: GuideSetupStepId): boolean | null => {
      return Object.prototype.hasOwnProperty.call(manual, id) ? Boolean(manual[id]) : null
    },
    [manual]
  )

  const isComplete = React.useCallback(
    (id: GuideSetupStepId) => {
      const manualOverride = manualOverrideFor(id)
      if (manualOverride === true) return true
      if (manualOverride === false) return false
      return Boolean(auto[id])
    },
    [auto, manualOverrideFor]
  )

  const doneCount = React.useMemo(() => {
    let n = 0
    for (const id of GUIDE_SETUP_STEP_IDS) {
      if (isComplete(id)) n += 1
    }
    return n
  }, [isComplete])

  const total = GUIDE_SETUP_STEP_IDS.length
  const pct = Math.round((doneCount / total) * 100)

  return (
    <section className="space-y-4 rounded-3xl border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">{percentLabel(pct)}</span>
          <span className="tabular-nums text-muted-foreground">
            {doneCount}/{total}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {GUIDE_SETUP_STEP_IDS.map((id) => {
          const autoComplete = Boolean(auto[id])
          const manualOverride = manualOverrideFor(id)
          const checked = isComplete(id)
          const stepNote = stepNoteForStep(id)
          return (
            <li
              key={id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 dark:bg-muted/10",
                checked && "border-primary/25 bg-[color:var(--nav-active-bg)]/60 dark:bg-primary/5"
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onSetManualOverride(id, checked ? false : true)}
                  aria-label={stepAriaLabel(id, checked)}
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground"
                  )}
                >
                  {checked ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-3.5" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-snug text-foreground">{labels[id]}</p>
                  {manualOverride === true ? (
                    <p className="text-xs text-primary">{statusMarkedManualLabel}</p>
                  ) : manualOverride === false ? (
                    <p className="text-xs text-muted-foreground">{statusUncheckedManualLabel}</p>
                  ) : autoComplete ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">{statusDetectedAutoLabel}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">{statusNotCompletedLabel}</p>
                  )}
                  {stepNote ? <p className="text-xs text-muted-foreground">{stepNote}</p> : null}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="outline" size="sm" className="h-9 w-full sm:w-auto" asChild>
                  <Link href={hrefForStep(id)}>{goLabel}</Link>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-full sm:w-auto"
                  onClick={() => onSetManualOverride(id, checked ? false : true)}
                >
                  {checked ? undoLabel : markDoneLabel}
                </Button>
                {manualOverride !== null ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 w-full sm:w-auto"
                    onClick={() => onSetManualOverride(id, null)}
                  >
                    {useAutomaticStatusLabel}
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
