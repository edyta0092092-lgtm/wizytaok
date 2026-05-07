"use client"

import * as React from "react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { ManualAppointmentSheet } from "@/components/appointments/manual-appointment-sheet"
import { AppointmentsPageBanners } from "@/components/appointments/appointments-page-banners"
import { AppointmentsFiltersAndListSection } from "@/components/appointments/appointments-filters-and-list-section"
import { AppointmentsPagePrimaryAction } from "@/components/appointments/appointments-page-primary-action"
import { useAppointmentsStore } from "@/lib/appointments/appointments-store"
import { useAppointmentsFiltersController } from "@/lib/appointments/use-appointments-filters-controller"
import { useAppointmentsUrlSyncedFilters } from "@/lib/appointments/use-appointments-url-synced-filters"
import { useAppointmentsStaffForFilters } from "@/lib/appointments/use-appointments-staff-for-filters"
import { useAppointmentsListPresentation } from "@/lib/appointments/use-appointments-list-presentation"
import { useProposeVisitPanel } from "@/lib/appointments/use-propose-visit-panel"
import { useStaffByServiceCacheForAppointments } from "@/lib/appointments/use-staff-by-service-cache-for-appointments"
import { useAppointmentsTransientBanners } from "@/lib/appointments/use-appointments-transient-banners"
import { useAppointmentsDeleteFlow } from "@/lib/appointments/use-appointments-delete-flow"
import { useAppointmentsPageListController } from "@/lib/appointments/use-appointments-page-list-controller"
import { useManualAppointmentCreateSheet } from "@/lib/appointments/use-manual-appointment-create-sheet"
import { appointmentsUiLanguage } from "@/lib/appointments/appointments-ui-language"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AppointmentsPageInner() {
  // Access, i18n and source data.
  const { ready: accessReady, canDeleteBookings } = useBusinessAccess()
  const { t, language } = useTranslations()
  const { appointments } = useAppointmentsStore()
  const {
    filter,
    setFilter,
    sourceFilter,
    staffFilter,
    restrictToToday,
    setSourceFilterAndUrl,
    setStaffFilterAndUrl,
  } = useAppointmentsUrlSyncedFilters()
  const { allStaffMembers, staffLoading, staffLoadError, staffSelectOptions } =
    useAppointmentsStaffForFilters(appointments, staffFilter, setStaffFilterAndUrl)
  const { filtered, grouped, formatWhen } = useAppointmentsListPresentation({
    appointments,
    filter,
    sourceFilter,
    staffFilter,
    restrictToToday,
    language,
  })

  // Page-level UI state.
  const [showAdded, setShowAdded] = React.useState(false)
  const [actionNotice, setActionNotice] = React.useState("")
  const allowAppointmentDelete = accessReady && canDeleteBookings
  const { staffByService, setStaffByService } = useStaffByServiceCacheForAppointments(appointments)

  const hasActiveTeamMembers = React.useMemo(
    () => allStaffMembers.some((m) => m.isActive),
    [allStaffMembers],
  )

  const uiLang = appointmentsUiLanguage(language)

  // Delete flow.
  const {
    setConfirmDeleteAppointmentId,
    effectiveConfirmDeleteAppointmentId,
    handleConfirmDeleteAppointment,
    isDeletingAppointment,
  } = useAppointmentsDeleteFlow({
    allowAppointmentDelete,
    appointments,
    language: uiLang,
    t,
    setActionNotice,
  })

  // Create sheet flow.
  const {
    sheetOpen: createOpen,
    setSheetOpen: setCreateOpen,
    form,
    setForm,
    isSaving,
    manualServiceOptions,
    manualStaffForService,
    canSubmitManual,
    openCreate,
    saveManual,
  } = useManualAppointmentCreateSheet({
    hasActiveTeamMembers,
    t,
    setActionNotice,
    setShowAdded,
  })

  // Propose/edit panel flow.
  const {
    proposeForId,
    setProposeForId,
    proposeDate,
    setProposeDate,
    proposeTime,
    setProposeTime,
    proposeValidationError,
    setProposeValidationError,
    proposeStaffId,
    setProposeStaffId,
    proposeAvailableStaffIds,
    proposeResolvedServiceId,
    setProposeResolvedServiceId,
    proposeStaffListForService,
    setProposeStaffListForService,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
    setConfirmCancelVisitForId,
    openProposeAnotherTime,
    saveDirectVisitChange,
    executeCancelVisit,
    executeRemoveVisit,
  } = useProposeVisitPanel({
    appointments,
    manualServiceOptions,
    staffByService,
    setStaffByService,
    hasActiveTeamMembers,
    t,
    language: uiLang,
    setActionNotice,
  })

  useAppointmentsTransientBanners({ showAdded, setShowAdded, actionNotice, setActionNotice })

  // View-models for page sections.
  const appointmentsListBundles = useAppointmentsPageListController({
    t,
    setActionNotice,
    grouped,
    filteredCount: filtered.length,
    staffFilter,
    listFilter: filter,
    formatWhen,
    listUiLanguage: uiLang,
    staffByService,
    hasActiveTeamMembers,
    allowAppointmentDelete,
    onEditVisit: openProposeAnotherTime,
    setConfirmDeleteAppointmentId,
    effectiveConfirmDeleteRowId: effectiveConfirmDeleteAppointmentId,
    onDeleteConfirm: handleConfirmDeleteAppointment,
    isDeletingAppointment,
    proposeForId,
    proposeDate,
    proposeTime,
    setProposeDate,
    setProposeTime,
    proposeValidationError,
    setProposeValidationError,
    proposeStaffId,
    setProposeStaffId,
    proposeAvailableStaffIds,
    proposeResolvedServiceId,
    proposeStaffListForService,
    setProposeForId,
    setProposeResolvedServiceId,
    setProposeStaffListForService,
    setConfirmCancelVisitForId,
    saveDirectVisitChange,
    executeCancelVisit,
    executeRemoveVisit,
    isSavingDirectEdit,
    isCancellingVisit,
    confirmCancelVisitForId,
  })

  const filtersController = useAppointmentsFiltersController({
    sourceFilter,
    onSourceFilterChange: setSourceFilterAndUrl,
    staffFilter,
    onStaffFilterChange: setStaffFilterAndUrl,
    staffLoading,
    staffLoadError,
    staffSelectOptions,
    filter,
    onFilterChange: setFilter,
    restrictToToday,
  })

  return (
    <AppShell
      title={t("navigation.appointments")}
      pageDescription={t("appointments.description")}
      primaryAction={
        <AppointmentsPagePrimaryAction label={t("common.addAppointment")} onClick={openCreate} />
      }
    >
      <PageShell>
        <AppointmentsPageBanners
          showAdded={showAdded}
          appointmentAddedLabel={t("appointments.appointmentAdded")}
          actionNotice={actionNotice}
        />
        <AppointmentsFiltersAndListSection
          filters={filtersController}
          list={appointmentsListBundles}
        />
      </PageShell>
      <ManualAppointmentSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        manualServiceOptions={manualServiceOptions}
        manualStaffForService={manualStaffForService}
        hasActiveTeamMembers={hasActiveTeamMembers}
        canSubmitManualAppointment={canSubmitManual}
        isSaving={isSaving}
        language={language}
        onSubmit={saveManual}
      />
    </AppShell>
  )
}
