"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getStepConfig, type OnboardingStepId } from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

const STEP_PATHS: Record<OnboardingStepId, string> = {
  working_hours: "/availability",
  team_member: "/team",
  service: "/services",
  staff_service: "/team",
  booking_page: "/settings",
  first_visit: "/appointments",
}

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
}

export function OnboardingFlowHint() {
  const { t } = useTranslations()
  const pathname = usePathname()
  const { flowActive, activeStepId, snapshot, continueSetup, skipForNow } = useOnboarding()
  const [highlightRect, setHighlightRect] = React.useState<HighlightRect | null>(null)

  React.useEffect(() => {
    if (!flowActive || !activeStepId || !snapshot) return
    const stepPath = STEP_PATHS[activeStepId]
    if (!pathname.startsWith(stepPath) || snapshot.progress[activeStepId]) return

    const step = getStepConfig(activeStepId)
    let target: HTMLElement | null = null
    let scrollTimer: number | null = null
    let rectFrame: number | null = null

    const updateRect = () => {
      if (rectFrame) window.cancelAnimationFrame(rectFrame)
      rectFrame = window.requestAnimationFrame(() => {
        if (!target) {
          setHighlightRect(null)
          return
        }
        const rect = target.getBoundingClientRect()
        setHighlightRect({
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
        })
      })
    }

    const applyTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(step.targetSelector)
      if (nextTarget === target) return
      target?.removeAttribute("data-onboarding-highlight")
      target = nextTarget
      if (!target) {
        updateRect()
        return
      }
      target.setAttribute("data-onboarding-highlight", "true")
      updateRect()
      if (scrollTimer) window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        target?.scrollIntoView({ behavior: "smooth", block: "center" })
        updateRect()
      }, 120)
    }

    applyTarget()
    const observer = new MutationObserver(applyTarget)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-tour"],
      childList: true,
      subtree: true,
    })
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)

    return () => {
      observer.disconnect()
      if (scrollTimer) window.clearTimeout(scrollTimer)
      if (rectFrame) window.cancelAnimationFrame(rectFrame)
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
      target?.removeAttribute("data-onboarding-highlight")
    }
  }, [activeStepId, flowActive, pathname, snapshot])

  if (!flowActive || !activeStepId || !snapshot) return null
  const stepPath = STEP_PATHS[activeStepId]
  if (!pathname.startsWith(stepPath)) return null
  if (snapshot.progress[activeStepId]) return null

  const step = getStepConfig(activeStepId)

  return (
    <>
      <style>
        {`
          [data-onboarding-highlight="true"] {
            scroll-margin: 7rem;
          }
        `}
      </style>
      {highlightRect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[149] rounded-2xl border-[3px] border-primary transition-[top,left,width,height] duration-150"
          style={{
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: "0 0 0 8px color-mix(in srgb, var(--primary) 14%, transparent)",
          }}
        />
      ) : null}
      <div
        className={cn(
          "fixed bottom-4 left-4 right-4 z-[150] mx-auto max-w-md sm:left-auto sm:right-6",
        )}
      >
        <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-lg shadow-slate-900/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t("onboarding.flowBadge")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{t(step.titleKey)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(step.hintKey)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-9 rounded-xl" onClick={() => continueSetup()}>
              {t("onboarding.flowNext")}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => skipForNow()}>
              {t("onboarding.skipCard")}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
