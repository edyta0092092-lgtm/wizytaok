"use client"

import Link from "next/link"
import { CalendarPlus, MessageSquare, Phone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { appointmentsManualCreateHref } from "@/lib/appointments/appointments-manual-create-path"
import { useMobileKeyboardInset } from "@/lib/mobile/use-mobile-keyboard-inset"
import { useMobilePanelActions } from "@/lib/mobile/mobile-panel-actions-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

type CustomerProfileMobileActionsProps = {
  phone: string
  className?: string
}

export function CustomerProfileMobileActions({ phone, className }: CustomerProfileMobileActionsProps) {
  const { t } = useTranslations()
  const panelActions = useMobilePanelActions()
  const keyboardInset = useMobileKeyboardInset()
  const phoneHref = phone.trim() ? `tel:${phone.replace(/\s/g, "")}` : null
  const smsHref = phone.trim() ? `sms:${phone.replace(/\s/g, "")}` : null

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-40 border-t border-border bg-background/95 px-3 py-3 backdrop-blur-sm lg:hidden",
        className,
      )}
      style={{
        bottom: `calc(var(--mobile-bottom-stack-height, calc(3.5rem + env(safe-area-inset-bottom, 0px))) + ${keyboardInset}px)`,
      }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
        {phoneHref ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 touch-manipulation flex-col gap-1 rounded-xl px-2 text-xs font-semibold"
            asChild
          >
            <a href={phoneHref}>
              <Phone className="size-4" aria-hidden />
              {t("customers.profile.actionCall")}
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 touch-manipulation flex-col gap-1 rounded-xl px-2 text-xs font-semibold"
            disabled
          >
            <Phone className="size-4" aria-hidden />
            {t("customers.profile.actionCall")}
          </Button>
        )}

        {smsHref ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 touch-manipulation flex-col gap-1 rounded-xl px-2 text-xs font-semibold"
            asChild
          >
            <a href={smsHref}>
              <MessageSquare className="size-4" aria-hidden />
              {t("customers.profile.actionSms")}
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 touch-manipulation flex-col gap-1 rounded-xl px-2 text-xs font-semibold"
            disabled
          >
            <MessageSquare className="size-4" aria-hidden />
            {t("customers.profile.actionSms")}
          </Button>
        )}

        {panelActions ? (
          <Button
            type="button"
            className="h-12 touch-manipulation flex-col gap-1 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={panelActions.openNewAppointment}
          >
            <CalendarPlus className="size-4" aria-hidden />
            {t("customers.profile.bookAppointment")}
          </Button>
        ) : (
          <Button
            type="button"
            className="h-12 touch-manipulation flex-col gap-1 rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            asChild
          >
            <Link href={appointmentsManualCreateHref()}>
              <CalendarPlus className="size-4" aria-hidden />
              {t("customers.profile.bookAppointment")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
