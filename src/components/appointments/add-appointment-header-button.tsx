"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { appointmentsManualCreateHref } from "@/lib/appointments/appointments-manual-create-path"
import { useTranslations } from "@/lib/i18n/use-translations"

type AddAppointmentHeaderButtonProps = {
  onClick?: () => void
  href?: string
}

/** Przycisk „Dodaj wizytę” — sheet (onClick) lub przejście do ręcznego dodania (href). */
export function AddAppointmentHeaderButton({ onClick, href }: AddAppointmentHeaderButtonProps) {
  const { t } = useTranslations()
  const targetHref = href ?? appointmentsManualCreateHref()
  if (!onClick) {
    return (
      <Button type="button" size="lg" className="h-10 px-4 text-sm" asChild>
        <Link href={targetHref}>{t("common.addAppointment")}</Link>
      </Button>
    )
  }
  return (
    <Button type="button" size="lg" className="h-10 px-4 text-sm" onClick={onClick}>
      {t("common.addAppointment")}
    </Button>
  )
}
