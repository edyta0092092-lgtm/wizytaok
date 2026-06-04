"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"

/** Przycisk „Dodaj wizytę” — prowadzi na publiczną stronę rezerwacji firmy. */
export function AddAppointmentHeaderButton({ href }: { href: string }) {
  const { t } = useTranslations()
  return (
    <Button type="button" size="lg" className="h-10 px-4 text-sm" asChild>
      <Link href={href}>{t("common.addAppointment")}</Link>
    </Button>
  )
}
