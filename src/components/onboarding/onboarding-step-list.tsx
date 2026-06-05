"use client"

import { Check } from "lucide-react"

import {
  completedStepCount,
  getOnboardingSteps,
  type OnboardingStepId,
} from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { cn } from "@/lib/utils"

type OnboardingStepListProps = {
  progress: Record<OnboardingStepId, boolean>
  activeStepId: OnboardingStepId | null
  t: (key: string) => string
  /** Kliknięcie wiersza / znacznika — przejście do kroku. */
  interactive?: boolean
}

export function OnboardingStepList({
  progress,
  activeStepId,
  t,
  interactive = false,
}: OnboardingStepListProps) {
  const { isAdmin, jumpToStep } = useOnboarding()
  const steps = getOnboardingSteps(isAdmin)

  return (
    <ul className="space-y-1.5" role="list">
      {steps.map((step) => {
        const done = progress[step.id]
        const active = activeStepId === step.id
        const label = t(step.shortKey)

        const content = (
          <>
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : active
                    ? "border-primary text-primary ring-2 ring-primary/25"
                    : "border-border bg-background text-muted-foreground",
                interactive && "group-hover:border-primary/60",
              )}
              aria-hidden
            >
              {done ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 text-left leading-snug",
                done && "text-foreground",
                !done && !active && "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </>
        )

        if (!interactive) {
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active && "bg-[color:var(--nav-active-bg)]",
              )}
            >
              {content}
            </li>
          )
        }

        return (
          <li key={step.id}>
            <button
              type="button"
              className={cn(
                "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                active && "bg-[color:var(--nav-active-bg)]",
              )}
              onClick={() => jumpToStep(step.id)}
              aria-current={active ? "step" : undefined}
              aria-label={t("onboarding.jumpToStep").replace("{step}", label)}
            >
              {content}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function onboardingStepCount(
  progress: Record<OnboardingStepId, boolean>,
  isAdmin: boolean,
): {
  done: number
  total: number
} {
  const total = getOnboardingSteps(isAdmin).length
  return {
    done: completedStepCount(progress, isAdmin),
    total,
  }
}
