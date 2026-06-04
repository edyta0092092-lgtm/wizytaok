/**
 * Centrum pomocy — pełny opis funkcji panelu (zgodny z UI 2026).
 * Setup krok po kroku: onboarding na planie dnia (osobny kreator).
 */

import type { GuideReferenceSection } from "@/lib/guide/guide-reference"

export type HelpCenterCategoryId =
  | "schedule"
  | "appointments"
  | "notifications"
  | "booking"
  | "billing"
  | "team"
  | "other"

export type HelpCenterCategory = {
  id: HelpCenterCategoryId
  titleKey: string
  descriptionKey: string
}

export const HELP_CENTER_CATEGORIES: HelpCenterCategory[] = [
  {
    id: "schedule",
    titleKey: "guide.catSchedule",
    descriptionKey: "guide.catScheduleDesc",
  },
  {
    id: "appointments",
    titleKey: "guide.catAppointments",
    descriptionKey: "guide.catAppointmentsDesc",
  },
  {
    id: "notifications",
    titleKey: "guide.catNotifications",
    descriptionKey: "guide.catNotificationsDesc",
  },
  {
    id: "booking",
    titleKey: "guide.catBooking",
    descriptionKey: "guide.catBookingDesc",
  },
  {
    id: "billing",
    titleKey: "guide.catBilling",
    descriptionKey: "guide.catBillingDesc",
  },
  {
    id: "team",
    titleKey: "guide.catTeam",
    descriptionKey: "guide.catTeamDesc",
  },
  {
    id: "other",
    titleKey: "guide.catOther",
    descriptionKey: "guide.catOtherDesc",
  },
]

const S = (
  section: Omit<GuideReferenceSection, "searchTags"> & {
    searchTags: string[]
    category: HelpCenterCategoryId
  },
): HelpCenterSection => section as HelpCenterSection

export type HelpCenterSection = GuideReferenceSection & {
  category: HelpCenterCategoryId
}

export const HELP_CENTER_SECTIONS: HelpCenterSection[] = [
  S({
    id: "availability-hours",
    category: "schedule",
    titleKey: "guide.hcAvailTitle",
    href: "/availability",
    ctaKey: "guide.navAvailability",
    searchTags: ["dostępność", "godziny", "tydzień", "otwarte", "zapisz"],
    blocks: [
      { type: "lead", key: "guide.hcAvailLead" },
      { type: "steps", key: "guide.hcAvailSteps" },
      { type: "tip", key: "guide.hcAvailTip" },
    ],
  }),
  S({
    id: "availability-exceptions",
    category: "schedule",
    titleKey: "guide.hcAvailExTitle",
    href: "/availability",
    ctaKey: "guide.navAvailability",
    searchTags: ["święta", "urlop", "wyjątek", "dzień wolny", "nieczynne"],
    blocks: [
      { type: "lead", key: "guide.hcAvailExLead" },
      { type: "steps", key: "guide.hcAvailExSteps" },
    ],
  }),
  S({
    id: "schedule-month",
    category: "schedule",
    titleKey: "guide.modScheduleTitle",
    href: "/schedule",
    ctaKey: "guide.navCalendar",
    searchTags: ["grafik", "kalendarz", "miesiąc", "dzień", "terminarz"],
    blocks: [
      { type: "lead", key: "guide.modScheduleLead" },
      { type: "bullets", key: "guide.modScheduleBullets" },
      { type: "steps", key: "guide.modScheduleSteps" },
    ],
  }),
  S({
    id: "team-schedule-exceptions",
    category: "schedule",
    titleKey: "guide.hcStaffScheduleTitle",
    href: "/team",
    ctaKey: "guide.navTeam",
    searchTags: ["zespół", "grafik osoby", "urlop", "wyjątek", "pracownik"],
    blocks: [
      { type: "lead", key: "guide.hcStaffScheduleLead" },
      { type: "steps", key: "guide.hcStaffScheduleSteps" },
    ],
  }),
  S({
    id: "slots-and-breaks",
    category: "schedule",
    titleKey: "guide.hcSlotsTitle",
    searchTags: ["slot", "zajęty", "przerwa", "termin", "rezerwacja"],
    blocks: [
      { type: "lead", key: "guide.hcSlotsLead" },
      { type: "bullets", key: "guide.hcSlotsBlocking" },
      { type: "bullets", key: "guide.hcSlotsNonBlocking" },
      { type: "body", key: "guide.hcSlotsBreakBody" },
    ],
  }),
  S({
    id: "day-plan",
    category: "appointments",
    titleKey: "guide.modDayplanTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    searchTags: ["plan dnia", "dziś", "podpowiedź", "konfiguracja"],
    blocks: [
      { type: "lead", key: "guide.hcDayplanLead" },
      { type: "bullets", key: "guide.hcDayplanBullets" },
      { type: "steps", key: "guide.hcDayplanSteps" },
    ],
  }),
  S({
    id: "first-setup",
    category: "appointments",
    titleKey: "guide.hcFirstSetupTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    searchTags: ["pierwsza konfiguracja", "onboarding", "kreator", "start"],
    blocks: [
      { type: "lead", key: "guide.hcFirstSetupLead" },
      { type: "steps", key: "guide.hcFirstSetupSteps" },
      { type: "tip", key: "guide.hcFirstSetupTip" },
    ],
  }),
  S({
    id: "appointments-list",
    category: "appointments",
    titleKey: "guide.hcApptListTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wizyty", "lista", "filtr", "status", "dodaj"],
    blocks: [
      { type: "lead", key: "guide.hcApptListLead" },
      { type: "bullets", key: "guide.hcApptStatuses" },
      { type: "steps", key: "guide.hcApptListSteps" },
    ],
  }),
  S({
    id: "appointments-needs-action",
    category: "appointments",
    titleKey: "guide.hcNeedsActionTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wymaga działania", "wymaga reakcji", "po wizycie", "status"],
    blocks: [
      { type: "lead", key: "guide.hcNeedsActionLead" },
      { type: "bullets", key: "guide.hcNeedsActionBullets" },
      { type: "steps", key: "guide.hcNeedsActionSteps" },
    ],
  }),
  S({
    id: "appointments-add-manual",
    category: "appointments",
    titleKey: "guide.hcManualApptTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["dodaj wizytę", "ręcznie", "telefon", "klient"],
    blocks: [
      { type: "lead", key: "guide.hcManualApptLead" },
      { type: "steps", key: "guide.hcManualApptSteps" },
    ],
  }),
  S({
    id: "appointments-change-status",
    category: "appointments",
    titleKey: "guide.hcApptStatusMenuTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["zmień status", "zrealizowana", "nieobecność", "anuluj"],
    blocks: [
      { type: "lead", key: "guide.hcApptStatusMenuLead" },
      { type: "bullets", key: "guide.hcApptStatusMenuBullets" },
      { type: "steps", key: "guide.hcApptStatusMenuSteps" },
    ],
  }),
  S({
    id: "appointments-client-change",
    category: "appointments",
    titleKey: "guide.hcClientChangeTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["prośba klienta", "zmiana terminu", "confirm", "link"],
    blocks: [
      { type: "lead", key: "guide.hcClientChangeLead" },
      { type: "steps", key: "guide.hcClientChangeSteps" },
    ],
  }),
  S({
    id: "appointments-cancel",
    category: "appointments",
    titleKey: "guide.hcCancelTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["anuluj", "anulowana", "odwołanie"],
    blocks: [
      { type: "lead", key: "guide.hcCancelLead" },
      { type: "steps", key: "guide.hcCancelSteps" },
    ],
  }),
  S({
    id: "messages-templates",
    category: "notifications",
    titleKey: "guide.modMsgsTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["szablony", "sms", "email", "przypomnienie", "48h"],
    blocks: [
      { type: "lead", key: "guide.hcMsgsLead" },
      { type: "bullets", key: "guide.hcMsgsBullets" },
      { type: "steps", key: "guide.hcMsgsSteps" },
    ],
  }),
  S({
    id: "messages-custom-templates",
    category: "notifications",
    titleKey: "guide.hcCustomTemplatesTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["własny szablon", "ręczna wysyłka", "custom"],
    blocks: [
      { type: "lead", key: "guide.hcCustomTemplatesLead" },
      { type: "steps", key: "guide.hcCustomTemplatesSteps" },
    ],
  }),
  S({
    id: "messages-history",
    category: "notifications",
    titleKey: "guide.hcMsgHistoryTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["historia wysyłek", "błąd", "pominięte", "wysłano"],
    blocks: [
      { type: "lead", key: "guide.hcMsgHistoryLead" },
      { type: "bullets", key: "guide.hcMsgHistoryBullets" },
      { type: "steps", key: "guide.hcMsgHistorySteps" },
    ],
  }),
  S({
    id: "reminders-settings",
    category: "notifications",
    titleKey: "guide.hcRemindersTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["przypomnienia", "kanał", "sms", "drugie przypomnienie"],
    blocks: [
      { type: "lead", key: "guide.hcRemindersLead" },
      { type: "bullets", key: "guide.hcRemindersBullets" },
      { type: "body", key: "guide.hcRemindersBody" },
    ],
  }),
  S({
    id: "booking-link",
    category: "booking",
    titleKey: "guide.hcBookingLinkTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["link", "rezerwacje", "slug", "qr", "udostępnij"],
    blocks: [
      { type: "lead", key: "guide.hcBookingLinkLead" },
      { type: "steps", key: "guide.hcBookingLinkSteps" },
    ],
  }),
  S({
    id: "booking-public-flow",
    category: "booking",
    titleKey: "guide.modBookingTitle",
    ctaKey: "guide.navBooking",
    searchTags: ["rezerwacja online", "klient", "usługa", "termin", "strona"],
    blocks: [
      { type: "lead", key: "guide.hcBookingFlowLead" },
      { type: "bullets", key: "guide.modBookingFlow" },
      { type: "steps", key: "guide.modBookingSteps" },
    ],
  }),
  S({
    id: "booking-manage-page",
    category: "booking",
    titleKey: "guide.modManageTitle",
    searchTags: ["confirm", "potwierdź", "klient", "anuluj", "zmiana"],
    blocks: [
      { type: "lead", key: "guide.modManageLead" },
      { type: "bullets", key: "guide.modManageFlow" },
      { type: "steps", key: "guide.modManageSteps" },
    ],
  }),
  S({
    id: "services",
    category: "team",
    titleKey: "guide.modServicesTitle",
    href: "/services",
    ctaKey: "guide.navServices",
    searchTags: ["usługi", "cena", "czas trwania", "przerwa", "godziny usługi"],
    blocks: [
      { type: "lead", key: "guide.modServicesLead" },
      { type: "steps", key: "guide.modServicesSteps" },
      { type: "lead", key: "guide.modServicesHoursTitle" },
      { type: "steps", key: "guide.modServicesHoursSteps" },
    ],
  }),
  S({
    id: "team-members",
    category: "team",
    titleKey: "guide.modTeamTitle",
    href: "/team",
    ctaKey: "guide.navTeam",
    searchTags: ["zespół", "zaproszenie", "rola", "przypisanie usług"],
    blocks: [
      { type: "lead", key: "guide.modTeamLead" },
      { type: "steps", key: "guide.modTeamSteps" },
      { type: "lead", key: "guide.modRolesTitle" },
      { type: "bullets", key: "guide.modRolesBullets" },
    ],
  }),
  S({
    id: "billing-trial",
    category: "billing",
    titleKey: "guide.hcBillingTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["trial", "stripe", "subskrypcja", "płatność", "dostęp"],
    blocks: [
      { type: "lead", key: "guide.hcBillingLead" },
      { type: "bullets", key: "guide.hcBillingBullets" },
      { type: "steps", key: "guide.hcBillingSteps" },
    ],
  }),
  S({
    id: "statistics",
    category: "other",
    titleKey: "guide.hcStatisticsTitle",
    href: "/statystyki",
    ctaKey: "guide.navStatistics",
    searchTags: ["statystyki", "wykres", "kpi", "nieobecność", "anulowane"],
    blocks: [
      { type: "lead", key: "guide.hcStatisticsLead" },
      { type: "bullets", key: "guide.hcStatisticsBullets" },
      { type: "steps", key: "guide.hcStatisticsSteps" },
    ],
  }),
  S({
    id: "business-settings",
    category: "other",
    titleKey: "guide.modBusinessTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["ustawienia", "firma", "nip", "język", "motyw"],
    blocks: [
      { type: "lead", key: "guide.modBusinessLead" },
      { type: "steps", key: "guide.modBusinessSteps" },
    ],
  }),
  S({
    id: "clients-secondary",
    category: "other",
    titleKey: "guide.hcClientsTitle",
    href: "/clients",
    ctaKey: "guide.navClients",
    searchTags: ["klienci", "notatki", "kontakt", "eksport"],
    blocks: [
      { type: "lead", key: "guide.hcClientsLead" },
      { type: "steps", key: "guide.hcClientsSteps" },
      { type: "tip", key: "guide.hcClientsTip" },
    ],
  }),
  S({
    id: "export-csv",
    category: "other",
    titleKey: "guide.hcExportTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["csv", "eksport", "excel"],
    blocks: [
      { type: "lead", key: "guide.hcExportLead" },
      { type: "steps", key: "guide.hcExportSteps" },
    ],
  }),
  S({
    id: "help-support",
    category: "other",
    titleKey: "guide.modHelpTitle",
    href: "/help",
    ctaKey: "guide.navHelp",
    searchTags: ["pomoc", "support", "czat", "obsługa"],
    blocks: [
      { type: "lead", key: "guide.modHelpLead" },
      { type: "steps", key: "guide.hcHelpSteps" },
    ],
  }),
]

export const HELP_CENTER_SECTIONS_TYPED = HELP_CENTER_SECTIONS

export const HELP_CENTER_FAQ_KEYS = [
  { q: "guide.faqQ1", a: "guide.faqA1" },
  { q: "guide.faqQ2", a: "guide.faqA2" },
  { q: "guide.faqQ3", a: "guide.faqA3" },
  { q: "guide.faqQ4", a: "guide.faqA4" },
  { q: "guide.faqQ5", a: "guide.faqA5" },
  { q: "guide.faqQ6", a: "guide.faqA6" },
  { q: "guide.faqQ7", a: "guide.faqA7" },
  { q: "guide.faqQ8", a: "guide.faqA8" },
  { q: "guide.faqQ9", a: "guide.faqA9" },
  { q: "guide.faqQ10", a: "guide.faqA10" },
  { q: "guide.faqQ11", a: "guide.faqA11" },
  { q: "guide.faqQ12", a: "guide.faqA12" },
] as const
