"use client"

import * as React from "react"

import { ManualAppointmentSheet } from "@/components/appointments/manual-appointment-sheet"
import { NewClientSheet } from "@/components/customers/new-client-sheet"
import { useAppointmentsStaffForFilters } from "@/lib/appointments/use-appointments-staff-for-filters"
import { appointmentsUiLanguage } from "@/lib/appointments/appointments-ui-language"
import { useManualAppointmentCreateSheet } from "@/lib/appointments/use-manual-appointment-create-sheet"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useNewClientSheet } from "@/lib/customers/use-new-client-sheet"
import { MobilePanelActionsProvider } from "@/lib/mobile/mobile-panel-actions-context"
import { useIsMobilePanel } from "@/lib/react/use-is-mobile-panel"
import { useTranslations } from "@/lib/i18n/use-translations"

type MobilePanelOverlaysProps = {
  children: React.ReactNode
  className?: string
}

export function MobilePanelOverlays({ children, className }: MobilePanelOverlaysProps) {
  const isMobile = useIsMobilePanel()
  const { t, language } = useTranslations()
  const { ready: accessReady, businessId, canManageClients } = useBusinessAccess()
  const { allStaffMembers } = useAppointmentsStaffForFilters([], "all", () => {})
  const hasActiveTeamMembers = React.useMemo(
    () => allStaffMembers.some((m) => m.isActive),
    [allStaffMembers],
  )

  const [, setShowAdded] = React.useState(false)
  const manualSheet = useManualAppointmentCreateSheet({
    businessId: accessReady ? businessId : null,
    hasActiveTeamMembers,
    language: appointmentsUiLanguage(language),
    t,
    setActionNotice: () => {},
    setShowAdded,
  })

  const clientSheet = useNewClientSheet(accessReady ? businessId : null)

  const actions = React.useMemo(
    () => ({
      openNewAppointment: manualSheet.openCreate,
      openNewClient: clientSheet.openCreate,
    }),
    [manualSheet.openCreate, clientSheet.openCreate],
  )

  if (!isMobile) {
    return <div className={className}>{children}</div>
  }

  return (
    <MobilePanelActionsProvider value={actions}>
      <div className={className}>{children}</div>
      <ManualAppointmentSheet
        open={manualSheet.sheetOpen}
        onOpenChange={manualSheet.setSheetOpen}
        form={manualSheet.form}
        setForm={manualSheet.setForm}
        manualServiceOptions={manualSheet.manualServiceOptions}
        manualStaffForService={manualSheet.manualStaffForService}
        manualAvailableStaffIds={manualSheet.manualAvailableStaffIds}
        hasActiveTeamMembers={hasActiveTeamMembers}
        canSubmitManualAppointment={manualSheet.canSubmitManual}
        isSaving={manualSheet.isSaving}
        language={appointmentsUiLanguage(language)}
        onSubmit={manualSheet.saveManual}
      />
      {canManageClients ? (
        <NewClientSheet
          open={clientSheet.sheetOpen}
          onOpenChange={clientSheet.setSheetOpen}
          form={clientSheet.form}
          setForm={clientSheet.setForm}
          fieldError={clientSheet.fieldError}
          isSaving={clientSheet.isSaving}
          onSubmit={(e) => void clientSheet.saveClient(e, t)}
        />
      ) : null}
    </MobilePanelActionsProvider>
  )
}

