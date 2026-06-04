"use client"

import { Button } from "@/components/ui/button"
import { useTranslations } from "@/lib/i18n/use-translations"

/** Przycisk „Dodaj wizytę” w nagłówku panelu (Plan dnia, Wizyty). */
export function AddAppointmentHeaderButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslations()
  return (
    <Button type="button" size="lg" className="h-10 px-4 text-sm" onClick={onClick}>
      {t("common.addAppointment")}
    </Button>
  )
}
