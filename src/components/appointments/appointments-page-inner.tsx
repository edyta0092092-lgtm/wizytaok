"use client"

import * as React from "react"

import { AppShell } from "@/components/layout/app-shell"
import { PageShell } from "@/components/layout/page-shell"
import { AppointmentsPageBanners } from "@/components/appointments/appointments-page-banners"
import { AppointmentsFiltersAndListSection } from "@/components/appointments/appointments-filters-and-list-section"
import { useAppointmentsStore } from "@/lib/appointments/appointments-store"
import {
  APPOINTMENTS_PANEL_DISMISSED_EVENT,
  filterDismissedAppointments,
} from "@/lib/appointments/appointments-panel-dismissed"
import { useAppointmentsFiltersController } from "@/lib/appointments/use-appointments-filters-controller"
import { useAppointmentsUrlSyncedFilters } from "@/lib/appointments/use-appointments-url-synced-filters"
import { useAppointmentsStaffForFilters } from "@/lib/appointments/use-appointments-staff-for-filters"
import { useAppointmentsListPresentation } from "@/lib/appointments/use-appointments-list-presentation"
import { useProposeVisitPanel } from "@/lib/appointments/use-propose-visit-panel"
import { useStaffByServiceCacheForAppointments } from "@/lib/appointments/use-staff-by-service-cache-for-appointments"
import { useAppointmentsTransientBanners } from "@/lib/appointments/use-appointments-transient-banners"
import { useAppointmentsDeleteFlow } from "@/lib/appointments/use-appointments-delete-flow"
import { useAppointmentsPageListController } from "@/lib/appointments/use-appointments-page-list-controller"
import { EMPTY_MANUAL_APPOINTMENT_FORM } from "@/lib/appointments/manual-appointment-form-defaults"
import { useManualAppointmentSheetData } from "@/lib/appointments/use-manual-appointment-sheet-data"
import { appointmentsUiLanguage } from "@/lib/appointments/appointments-ui-language"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"

export function AppointmentsPageInner() {
  const { ready: accessReady, canDeleteBookings, businessId } = useBusinessAccess()
  const { t, language } = useTranslations()
  const { appointments: allAppointments } = useAppointmentsStore(accessReady ? businessId : undefined)

  // Wizyty „usunięte z listy" znikają tylko z panelu — w bazie i w statystykach
  // pozostają (np. nadal liczone jako anulowane). Ten filtr działa wyłącznie tutaj.
  const [dismissTick, setDismissTick] = React.useState(0)
  React.useEffect(() => {
    const onDismissed = () => setDismissTick((n) => n + 1)
    window.addEventListener(APPOINTMENTS_PANEL_DISMISSED_EVENT, onDismissed)
    return () => window.removeEventListener(APPOINTMENTS_PANEL_DISMISSED_EVENT, onDismissed)
  }, [])
  const appointments = React.useMemo(
    () => filterDismissedAppointments(allAppointments, businessId),
    [allAppointments, businessId, dismissTick],
  )

  const { filter, setFilter, staffFilter, restrictToToday, setStaffFilterAndUrl } =
    useAppointmentsUrlSyncedFilters()
  const { allStaffMembers, staffLoading, staffLoadError, staffSelectOptions } =
    useAppointmentsStaffForFilters(appointments, staffFilter, setStaffFilterAndUrl)
  const [clientNameFilter, setClientNameFilter] = React.useState("")
  const [serviceFilter, setServiceFilter] = React.useState("")
  const serviceOptions = React.useMemo(() => {
    const unique = new Set<string>()
    for (const row of appointments) {
      const label = String(row.serviceLabel ?? "").trim()
      if (label) unique.add(label)
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b, language))
  }, [appointments, language])
  const { filtered, grouped, formatWhen } = useAppointmentsListPresentation({
    appointments,
    filter,
    staffFilter,
    restrictToToday,
    clientNameFilter,
    serviceFilter,
    language,
  })

  const [actionNotice, setActionNotice] = React.useState("")
  const allowAppointmentDelete = accessReady && canDeleteBookings
  const { staffByService, setStaffByService } = useStaffByServiceCacheForAppointments(appointments)

  const hasActiveTeamMembers = React.useMemo(
    () => allStaffMembers.some((m) => m.isActive),
    [allStaffMembers],
  )

  const uiLang = appointmentsUiLanguage(language)
  const [, setManualFormStub] = React.useState(EMPTY_MANUAL_APPOINTMENT_FORM)
  const { manualServiceOptions } = useManualAppointmentSheetData(
    businessId,
    "",
    "",
    "",
    setManualFormStub,
  )

  const {
    setConfirmDeleteAppointmentId,
    effectiveConfirmDeleteAppointmentId,
    handleConfirmDeleteAppointment,
    isDeletingAppointment,
  } = useAppointmentsDeleteFlow({
    allowAppointmentDelete,
    appointments,
    businessId,
    language: uiLang,
    t,
    setActionNotice,
  })

  const {
    proposeForId,
    setProposeForId,
    proposeDate,
    setProposeDate,
    proposeTime,
    setProposeTime,
    proposeCustomerNote,
    setProposeCustomerNote,
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

  useAppointmentsTransientBanners({ actionNotice, setActionNotice })

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
    proposeCustomerNote,
    setProposeDate,
    setProposeTime,
    setProposeCustomerNote,
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
    staffFilter,
    onStaffFilterChange: setStaffFilterAndUrl,
    staffLoading,
    staffLoadError,
    staffSelectOptions,
    filter,
    onFilterChange: setFilter,
    restrictToToday,
    clientNameFilter,
    onClientNameFilterChange: setClientNameFilter,
    serviceFilter,
    onServiceFilterChange: setServiceFilter,
    serviceOptions,
  })

  return (
    <AppShell title={t("navigation.appointments")} pageDescription={t("appointments.description")}>
      <PageShell>
        <AppointmentsPageBanners actionNotice={actionNotice} />
        <AppointmentsFiltersAndListSection
          filters={filtersController}
          list={appointmentsListBundles}
        />
      </PageShell>
    </AppShell>
  )
}
