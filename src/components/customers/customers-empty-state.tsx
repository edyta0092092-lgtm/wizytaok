"use client"

import { PanelEmptyState } from "@/components/shared/panel-empty-state"
import { appointmentsManualCreateHref } from "@/lib/appointments/appointments-manual-create-path"
import { useTranslations } from "@/lib/i18n/use-translations"

export function CustomersEmptyState({ filtered }: { filtered?: boolean }) {
  const { t } = useTranslations()

  if (filtered) {
    return (
      <PanelEmptyState
        title={t("customers.emptyFiltered")}
        description={t("customers.emptyFilteredHint")}
      />
    )
  }

  return (
    <PanelEmptyState
      title={t("customers.emptyTitle")}
      description={t("customers.emptyHint")}
      actionLabel={t("common.addAppointment")}
      actionHref={appointmentsManualCreateHref()}
    />
  )
}
