"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { getStepConfig } from "@/lib/onboarding/onboarding-steps"
import { useOnboarding } from "@/lib/onboarding/onboarding-provider"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type HighlightRect = {
  top: number
  left: number
  width: number
  height: number
}

export function OnboardingFlowHint() {
  const { t } = useTranslations()
  const pathname = usePathname()
  const {
    isAdmin,
    flowActive,
    activeStepId,
    snapshot,
    continueSetup,
    skipForNow,
    markActiveStepComplete,
  } = useOnboarding()
  const [highlightRect, setHighlightRect] = React.useState<HighlightRect | null>(null)
  const stepPath = activeStepId ? getStepConfig(activeStepId).path : null
  const stepProgressDone = activeStepId && snapshot ? snapshot.progress[activeStepId] : false
  const canShowStep =
    Boolean(flowActive && activeStepId && snapshot && stepPath && pathname.startsWith(stepPath)) &&
    !stepProgressDone

  React.useEffect(() => {
    if (canShowStep) return
    queueMicrotask(() => setHighlightRect(null))
  }, [canShowStep])

  React.useEffect(() => {
    if (!canShowStep || !activeStepId) return

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
        setHighlightRect((prev) => {
          const next = {
            top: Math.round(rect.top - 6),
            left: Math.round(rect.left - 6),
            width: Math.round(rect.width + 12),
            height: Math.round(rect.height + 12),
          }
          if (
            prev &&
            prev.top === next.top &&
            prev.left === next.left &&
            prev.width === next.width &&
            prev.height === next.height
          ) {
            return prev
          }
          return next
        })
      })
    }

    const applyTarget = () => {
      const nextTarget = document.querySelector<HTMLElement>(step.targetSelector)
      if (nextTarget === target) {
        updateRect()
        return
      }
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
        target?.scrollIntoView({ block: "center" })
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
    window.addEventListener("pw-layout-change", updateRect)

    return () => {
      observer.disconnect()
      if (scrollTimer) window.clearTimeout(scrollTimer)
      if (rectFrame) window.cancelAnimationFrame(rectFrame)
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
      window.removeEventListener("pw-layout-change", updateRect)
      target?.removeAttribute("data-onboarding-highlight")
    }
  }, [activeStepId, canShowStep])

  if (!canShowStep || !activeStepId) return null

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
          className="pointer-events-none fixed z-[149] rounded-2xl border-[3px] border-primary"
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
            {t(isAdmin ? "onboarding.flowBadge" : "onboarding.staffFlowBadge")}
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{t(step.titleKey)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(step.hintKey)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => {
                markActiveStepComplete()
                continueSetup()
              }}
            >
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
