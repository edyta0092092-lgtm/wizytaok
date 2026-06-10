"use client"

import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useMobilePanelActions } from "@/lib/mobile/mobile-panel-actions-context"
import { useIsMobilePanel } from "@/lib/react/use-is-mobile-panel"
import { useTranslations } from "@/lib/i18n/use-translations"

export function ScheduleMobileFab() {
  const isMobile = useIsMobilePanel()
  const actions = useMobilePanelActions()
  const { t } = useTranslations()

  if (!isMobile || !actions) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-end px-4 lg:hidden"
      style={{
        bottom:
          "calc(var(--mobile-bottom-stack-height, calc(3.5rem + env(safe-area-inset-bottom, 0px))) + 0.75rem)",
      }}
    >
      <Button
        type="button"
        className="pointer-events-auto h-14 touch-manipulation gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
        onClick={actions.openNewAppointment}
      >
        <Plus className="size-5" aria-hidden strokeWidth={2.25} />
        {t("schedule.mobileFabNew")}
      </Button>
    </div>
  )
}
