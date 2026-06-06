/**
 * Centrum pomocy / przewodnik panelu WizytaOK.
 * Treść tłumaczeń: `dictionaries.ts` → `guide.*`
 * Sekcje `adminOnly` widoczne tylko dla roli administrator.
 */

import type { GuideReferenceSection } from "@/lib/guide/guide-reference"

export type HelpCenterCategoryId =
  | "first-setup"
  | "schedule-availability"
  | "schedule-exceptions"
  | "team"
  | "services"
  | "appointments-statuses"
  | "cancel-appointments"
  | "online-booking"
  | "notifications"
  | "billing-trial"

export type HelpCenterCategory = {
  id: HelpCenterCategoryId
  titleKey: string
  descriptionKey: string
  /** Cała kategoria tylko dla administratora. */
  adminOnly?: boolean
}

/** Kolejność kart w Centrum pomocy (FAQ osobno na stronie). */
export const HELP_CENTER_CATEGORIES: HelpCenterCategory[] = [
  {
    id: "first-setup",
    titleKey: "guide.catFirstSetup",
    descriptionKey: "guide.catFirstSetupDesc",
  },
  {
    id: "schedule-availability",
    titleKey: "guide.catScheduleAvailability",
    descriptionKey: "guide.catScheduleAvailabilityDesc",
    adminOnly: true,
  },
  {
    id: "schedule-exceptions",
    titleKey: "guide.catScheduleExceptions",
    descriptionKey: "guide.catScheduleExceptionsDesc",
    adminOnly: true,
  },
  {
    id: "team",
    titleKey: "guide.catTeam",
    descriptionKey: "guide.catTeamDesc",
    adminOnly: true,
  },
  {
    id: "services",
    titleKey: "guide.catServices",
    descriptionKey: "guide.catServicesDesc",
    adminOnly: true,
  },
  {
    id: "appointments-statuses",
    titleKey: "guide.catAppointmentsStatuses",
    descriptionKey: "guide.catAppointmentsStatusesDesc",
  },
  {
    id: "cancel-appointments",
    titleKey: "guide.catCancelAppointments",
    descriptionKey: "guide.catCancelAppointmentsDesc",
  },
  {
    id: "online-booking",
    titleKey: "guide.catOnlineBooking",
    descriptionKey: "guide.catOnlineBookingDesc",
  },
  {
    id: "notifications",
    titleKey: "guide.catNotifications",
    descriptionKey: "guide.catNotificationsDesc",
  },
  {
    id: "billing-trial",
    titleKey: "guide.catBillingTrial",
    descriptionKey: "guide.catBillingTrialDesc",
    adminOnly: true,
  },
]

const S = (
  section: Omit<GuideReferenceSection, "searchTags"> & {
    searchTags: string[]
    category: HelpCenterCategoryId
    adminOnly?: boolean
  },
): HelpCenterSection => section as HelpCenterSection

export type HelpCenterSection = GuideReferenceSection & {
  category: HelpCenterCategoryId
  adminOnly?: boolean
}

export const HELP_CENTER_SECTIONS: HelpCenterSection[] = [
  // —— Start ——
  S({
    id: "welcome",
    category: "first-setup",
    titleKey: "guide.hcWelcomeTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    searchTags: ["start", "pierwsze logowanie", "panel", "wprowadzenie"],
    blocks: [
      { type: "lead", key: "guide.hcWelcomeLead" },
      { type: "steps", key: "guide.hcWelcomeSteps" },
      { type: "tip", key: "guide.hcWelcomeTip" },
    ],
  }),
  S({
    id: "panel-menu",
    category: "first-setup",
    titleKey: "guide.hcPanelMenuTitle",
    searchTags: ["menu", "nawigacja", "zakładki", "boczne"],
    blocks: [
      { type: "lead", key: "guide.hcPanelMenuLead" },
      { type: "bullets", key: "guide.hcPanelMenuBullets" },
    ],
  }),
  S({
    id: "statuses-reference",
    category: "first-setup",
    titleKey: "guide.hcStatusesTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["status", "zrealizowana", "anulowana", "nieobecność", "potwierdzona"],
    blocks: [
      { type: "lead", key: "guide.hcStatusesLead" },
      { type: "bullets", key: "guide.hcStatusesBullets" },
      { type: "body", key: "guide.hcStatusesLocked" },
    ],
  }),
  S({
    id: "roles-staff",
    category: "first-setup",
    titleKey: "guide.hcRolesStaffTitle",
    searchTags: ["rola", "obsługa", "uprawnienia", "dostęp"],
    blocks: [
      { type: "lead", key: "guide.hcRolesStaffLead" },
      { type: "bullets", key: "guide.hcRolesStaffBullets" },
    ],
  }),

  // —— Wizyty (admin + obsługa) ——
  S({
    id: "day-plan",
    category: "appointments-statuses",
    titleKey: "guide.modDayplanTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    searchTags: ["plan dnia", "dziś", "dashboard"],
    blocks: [
      { type: "lead", key: "guide.hcDayplanLead" },
      { type: "bullets", key: "guide.hcDayplanBullets" },
      { type: "steps", key: "guide.hcDayplanSteps" },
    ],
  }),
  S({
    id: "first-setup",
    category: "first-setup",
    titleKey: "guide.hcFirstSetupTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    adminOnly: true,
    searchTags: ["konfiguracja", "onboarding", "kreator"],
    blocks: [
      { type: "lead", key: "guide.hcFirstSetupLead" },
      { type: "steps", key: "guide.hcFirstSetupSteps" },
      { type: "tip", key: "guide.hcFirstSetupTip" },
    ],
  }),
  S({
    id: "appointments-list",
    category: "appointments-statuses",
    titleKey: "guide.hcApptListTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wizyty", "lista", "filtr"],
    blocks: [
      { type: "lead", key: "guide.hcApptListLead" },
      { type: "steps", key: "guide.hcApptListSteps" },
    ],
  }),
  S({
    id: "appointments-needs-action",
    category: "appointments-statuses",
    titleKey: "guide.hcNeedsActionTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wymaga działania", "po wizycie"],
    blocks: [
      { type: "lead", key: "guide.hcNeedsActionLead" },
      { type: "bullets", key: "guide.hcNeedsActionBullets" },
      { type: "steps", key: "guide.hcNeedsActionSteps" },
    ],
  }),
  S({
    id: "appointments-add-manual",
    category: "appointments-statuses",
    titleKey: "guide.hcManualApptTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["dodaj wizytę", "ręcznie"],
    blocks: [
      { type: "lead", key: "guide.hcManualApptLead" },
      { type: "steps", key: "guide.hcManualApptSteps" },
    ],
  }),
  S({
    id: "appointments-change-status",
    category: "appointments-statuses",
    titleKey: "guide.hcApptStatusMenuTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["zmień status", "zrealizowana", "zablokowany"],
    blocks: [
      { type: "lead", key: "guide.hcApptStatusMenuLead" },
      { type: "bullets", key: "guide.hcApptStatusMenuBullets" },
      { type: "steps", key: "guide.hcApptStatusMenuSteps" },
    ],
  }),
  S({
    id: "appointments-send-message",
    category: "appointments-statuses",
    titleKey: "guide.hcSendMessageTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wyślij wiadomość", "szablon ręczny", "sms"],
    blocks: [
      { type: "lead", key: "guide.hcSendMessageLead" },
      { type: "steps", key: "guide.hcSendMessageSteps" },
      { type: "tip", key: "guide.hcSendMessageTip" },
    ],
  }),
  S({
    id: "appointments-client-change",
    category: "appointments-statuses",
    titleKey: "guide.hcClientChangeTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["prośba klienta", "confirm", "zmiana terminu"],
    blocks: [
      { type: "lead", key: "guide.hcClientChangeLead" },
      { type: "steps", key: "guide.hcClientChangeSteps" },
    ],
  }),
  S({
    id: "appointments-cancel",
    category: "cancel-appointments",
    titleKey: "guide.hcCancelTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["anuluj", "anulowana"],
    blocks: [
      { type: "lead", key: "guide.hcCancelLead" },
      { type: "steps", key: "guide.hcCancelSteps" },
    ],
  }),
  S({
    id: "schedule-month",
    category: "schedule-availability",
    titleKey: "guide.modScheduleTitle",
    href: "/schedule",
    ctaKey: "guide.navCalendar",
    searchTags: ["grafik", "kalendarz", "miesiąc"],
    blocks: [
      { type: "lead", key: "guide.modScheduleLead" },
      { type: "bullets", key: "guide.modScheduleBullets" },
      { type: "steps", key: "guide.modScheduleSteps" },
    ],
  }),

  // —— Grafik i dostępność (admin) ——
  S({
    id: "availability-hours",
    category: "schedule-availability",
    titleKey: "guide.hcAvailTitle",
    href: "/availability",
    ctaKey: "guide.navAvailability",
    adminOnly: true,
    searchTags: ["dostępność", "godziny"],
    blocks: [
      { type: "lead", key: "guide.hcAvailLead" },
      { type: "steps", key: "guide.hcAvailSteps" },
      { type: "tip", key: "guide.hcAvailTip" },
    ],
  }),
  S({
    id: "availability-exceptions",
    category: "schedule-exceptions",
    titleKey: "guide.hcAvailExTitle",
    href: "/availability",
    ctaKey: "guide.navAvailability",
    adminOnly: true,
    searchTags: ["święta", "dzień wolny", "wyjątek"],
    blocks: [
      { type: "lead", key: "guide.hcAvailExLead" },
      { type: "steps", key: "guide.hcAvailExSteps" },
    ],
  }),
  S({
    id: "team-schedule-exceptions",
    category: "schedule-exceptions",
    titleKey: "guide.hcStaffScheduleTitle",
    href: "/team",
    ctaKey: "guide.navTeam",
    adminOnly: true,
    searchTags: ["zespół", "grafik osoby"],
    blocks: [
      { type: "lead", key: "guide.hcStaffScheduleLead" },
      { type: "steps", key: "guide.hcStaffScheduleSteps" },
    ],
  }),
  S({
    id: "slots-and-breaks",
    category: "schedule-availability",
    titleKey: "guide.hcSlotsTitle",
    adminOnly: true,
    searchTags: ["slot", "przerwa", "zajęty"],
    blocks: [
      { type: "lead", key: "guide.hcSlotsLead" },
      { type: "bullets", key: "guide.hcSlotsBlocking" },
      { type: "bullets", key: "guide.hcSlotsNonBlocking" },
      { type: "body", key: "guide.hcSlotsBreakBody" },
    ],
  }),

  // —— Powiadomienia ——
  S({
    id: "messages-history",
    category: "notifications",
    titleKey: "guide.hcMsgHistoryTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["historia wysyłek", "sms", "błąd"],
    blocks: [
      { type: "lead", key: "guide.hcMsgHistoryLead" },
      { type: "bullets", key: "guide.hcMsgHistoryBullets" },
      { type: "steps", key: "guide.hcMsgHistorySteps" },
    ],
  }),
  S({
    id: "messages-templates",
    category: "notifications",
    titleKey: "guide.hcTemplatesTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    adminOnly: true,
    searchTags: ["szablony", "przypomnienie", "email"],
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
    adminOnly: true,
    searchTags: ["własny szablon", "ręczny"],
    blocks: [
      { type: "lead", key: "guide.hcCustomTemplatesLead" },
      { type: "steps", key: "guide.hcCustomTemplatesSteps" },
    ],
  }),
  S({
    id: "reminders-settings",
    category: "notifications",
    titleKey: "guide.hcRemindersTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    adminOnly: true,
    searchTags: ["przypomnienia", "kanał", "ustawienia"],
    blocks: [
      { type: "lead", key: "guide.hcRemindersLead" },
      { type: "bullets", key: "guide.hcRemindersBullets" },
      { type: "body", key: "guide.hcRemindersBody" },
    ],
  }),

  // —— Rezerwacje online ——
  S({
    id: "booking-link",
    category: "online-booking",
    titleKey: "guide.hcBookingLinkTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    adminOnly: true,
    searchTags: ["link", "rezerwacje"],
    blocks: [
      { type: "lead", key: "guide.hcBookingLinkLead" },
      { type: "steps", key: "guide.hcBookingLinkSteps" },
    ],
  }),
  S({
    id: "booking-public-flow",
    category: "online-booking",
    titleKey: "guide.modBookingTitle",
    ctaKey: "guide.navBooking",
    searchTags: ["rezerwacja online", "klient"],
    blocks: [
      { type: "lead", key: "guide.hcBookingFlowLead" },
      { type: "bullets", key: "guide.modBookingFlow" },
      { type: "steps", key: "guide.modBookingSteps" },
      { type: "tip", key: "guide.modBookingTip" },
    ],
  }),
  S({
    id: "booking-manage-page",
    category: "online-booking",
    titleKey: "guide.modManageTitle",
    searchTags: ["confirm", "link klienta"],
    blocks: [
      { type: "lead", key: "guide.modManageLead" },
      { type: "bullets", key: "guide.modManageFlow" },
      { type: "steps", key: "guide.modManageSteps" },
    ],
  }),

  // —— Tylko administrator ——
  S({
    id: "admin-services",
    category: "services",
    titleKey: "guide.modServicesTitle",
    href: "/services",
    ctaKey: "guide.navServices",
    adminOnly: true,
    searchTags: ["usługi", "cena", "przerwa"],
    blocks: [
      { type: "lead", key: "guide.modServicesLead" },
      { type: "steps", key: "guide.modServicesSteps" },
      { type: "lead", key: "guide.modServicesHoursTitle" },
      { type: "steps", key: "guide.modServicesHoursSteps" },
    ],
  }),
  S({
    id: "admin-team",
    category: "team",
    titleKey: "guide.modTeamTitle",
    href: "/team",
    ctaKey: "guide.navTeam",
    adminOnly: true,
    searchTags: ["zespół", "zaproszenie", "rola"],
    blocks: [
      { type: "lead", key: "guide.modTeamLead" },
      { type: "steps", key: "guide.modTeamSteps" },
      { type: "bullets", key: "guide.hcAdminTeamRolesBullets" },
    ],
  }),
  S({
    id: "admin-settings",
    category: "first-setup",
    titleKey: "guide.modBusinessTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    adminOnly: true,
    searchTags: ["ustawienia", "firma", "subskrypcja"],
    blocks: [
      { type: "lead", key: "guide.modBusinessLead" },
      { type: "steps", key: "guide.modBusinessSteps" },
      { type: "bullets", key: "guide.hcAdminSettingsBullets" },
    ],
  }),
  S({
    id: "admin-billing",
    category: "billing-trial",
    titleKey: "guide.hcBillingTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    adminOnly: true,
    searchTags: ["trial", "stripe", "subskrypcja"],
    blocks: [
      { type: "lead", key: "guide.hcBillingLead" },
      { type: "bullets", key: "guide.hcBillingBullets" },
      { type: "steps", key: "guide.hcBillingSteps" },
    ],
  }),
  S({
    id: "admin-export",
    category: "billing-trial",
    titleKey: "guide.hcExportTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    adminOnly: true,
    searchTags: ["csv", "eksport"],
    blocks: [
      { type: "lead", key: "guide.hcExportLead" },
      { type: "steps", key: "guide.hcExportSteps" },
    ],
  }),

  // —— Pozostałe ——
  S({
    id: "clients",
    category: "appointments-statuses",
    titleKey: "guide.hcClientsTitle",
    href: "/klienci",
    ctaKey: "guide.navClients",
    searchTags: ["klienci", "notatki"],
    blocks: [
      { type: "lead", key: "guide.hcClientsLead" },
      { type: "steps", key: "guide.hcClientsSteps" },
      { type: "tip", key: "guide.hcClientsTip" },
    ],
  }),
  S({
    id: "statistics",
    category: "first-setup",
    titleKey: "guide.hcStatisticsTitle",
    href: "/statystyki",
    ctaKey: "guide.navStatistics",
    searchTags: ["statystyki", "wykres"],
    blocks: [
      { type: "lead", key: "guide.hcStatisticsLead" },
      { type: "bullets", key: "guide.hcStatisticsBullets" },
      { type: "steps", key: "guide.hcStatisticsSteps" },
    ],
  }),
  S({
    id: "account",
    category: "first-setup",
    titleKey: "guide.hcAccountTitle",
    href: "/account",
    ctaKey: "guide.navAccount",
    searchTags: ["konto", "hasło", "język"],
    blocks: [
      { type: "lead", key: "guide.hcAccountLead" },
      { type: "steps", key: "guide.hcAccountSteps" },
    ],
  }),
  S({
    id: "help-support",
    category: "first-setup",
    titleKey: "guide.modHelpTitle",
    href: "/help",
    ctaKey: "guide.navHelp",
    searchTags: ["pomoc", "support", "czat"],
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
  { q: "guide.faqQ13", a: "guide.faqA13" },
  { q: "guide.faqQ14", a: "guide.faqA14" },
] as const
