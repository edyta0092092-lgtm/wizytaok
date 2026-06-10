"use client"

import * as React from "react"
import { CalendarPlus, Plus, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useMobilePanelActions } from "@/lib/mobile/mobile-panel-actions-context"
import { useIsMobilePanel } from "@/lib/react/use-is-mobile-panel"
import { useTranslations } from "@/lib/i18n/use-translations"

export function MobileActionFab() {
  const isMobile = useIsMobilePanel()
  const actions = useMobilePanelActions()
  const { canManageClients } = useBusinessAccess()
  const { t } = useTranslations()
  const [open, setOpen] = React.useState(false)

  if (!isMobile || !actions) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-end px-4 lg:hidden"
      style={{
        bottom: "calc(5.25rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            aria-label={t("mobileFab.openMenu")}
            className="pointer-events-auto size-14 touch-manipulation rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
          >
            <Plus className="size-6" aria-hidden strokeWidth={2.25} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="end"
          sideOffset={12}
          className="pointer-events-auto w-56 rounded-2xl p-1.5"
        >
          <DropdownMenuItem
            className="min-h-11 touch-manipulation gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
            onSelect={() => {
              setOpen(false)
              actions.openNewAppointment()
            }}
          >
            <CalendarPlus className="size-4 text-primary" aria-hidden />
            {t("mobileFab.newAppointment")}
          </DropdownMenuItem>
          {canManageClients ? (
            <DropdownMenuItem
              className="min-h-11 touch-manipulation gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
              onSelect={() => {
                setOpen(false)
                actions.openNewClient()
              }}
            >
              <UserPlus className="size-4 text-primary" aria-hidden />
              {t("mobileFab.newClient")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
