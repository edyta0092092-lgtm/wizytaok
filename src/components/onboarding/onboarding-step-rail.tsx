"use client"

import { Check } from "lucide-react"

import {
  getOnboardingStepIndex,
  getOnboardingSteps,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { cn } from "@/lib/utils"

type OnboardingStepRailProps = {
  progress: Record<OnboardingStepId, boolean>
  activeStepId: OnboardingStepId | null
  t: (key: string) => string
  interactive?: boolean
  compact?: boolean
}

export function OnboardingStepRail({
  progress,
  activeStepId,
  t,
  interactive = false,
  compact = false,
}: OnboardingStepRailProps) {
  const { isAdmin, jumpToStep } = useOnboarding()
  const steps = getOnboardingSteps(isAdmin)

  return (
    <ol className="space-y-0" role="list">
      {steps.map((step, index) => {
        const done = progress[step.id]
        const active = activeStepId === step.id
        const label = t(step.shortKey)
        const stepNumber = getOnboardingStepIndex(step.id, isAdmin)
        const isLast = index === steps.length - 1

        const marker = (
          <span
            className={cn(
              "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
              done
                ? "border-primary bg-primary text-primary-foreground"
                : active
                  ? "border-primary bg-background text-primary ring-2 ring-primary/20"
                  : "border-border/80 bg-background text-muted-foreground",
            )}
            aria-hidden
          >
            {done ? <Check className="size-3.5" strokeWidth={2.5} /> : stepNumber}
          </span>
        )

        const row = (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cn(
                "text-sm font-medium leading-snug",
                done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {!compact && active ? (
              <span className="text-xs text-muted-foreground">{t(step.hintKey)}</span>
            ) : null}
          </div>
        )

        const inner = (
          <div className="flex gap-3 py-2.5">
            <div className="flex flex-col items-center">
              {marker}
              {!isLast ? (
                <span
                  className={cn(
                    "mt-1 w-px flex-1 min-h-[1.25rem] rounded-full",
                    done ? "bg-primary/40" : "bg-border/80",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            {row}
          </div>
        )

        if (!interactive) {
          return (
            <li
              key={step.id}
              className={cn(active && "rounded-xl bg-muted/30 px-2 -mx-2")}
            >
              {inner}
            </li>
          )
        }

        return (
          <li key={step.id}>
            <button
              type="button"
              className={cn(
                "w-full rounded-xl px-2 -mx-2 text-left transition-colors",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                active && "bg-muted/30",
              )}
              onClick={() => jumpToStep(step.id)}
              aria-current={active ? "step" : undefined}
            >
              {inner}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
