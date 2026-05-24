/**
 * Centrum pomocy — treści zgodne z aktualnym UI (2025).
 * Setup pierwszego uruchomienia: onboarding na planie dnia, nie tutaj.
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
    searchTags: ["dostępność", "godziny", "święta", "wyjątki", "dni wolne"],
    blocks: [
      { type: "lead", key: "guide.hcAvailLead" },
      { type: "steps", key: "guide.hcAvailSteps" },
      { type: "lead", key: "guide.hcAvailExTitle" },
      { type: "steps", key: "guide.hcAvailExSteps" },
    ],
  }),
  S({
    id: "schedule-month",
    category: "schedule",
    titleKey: "guide.modScheduleTitle",
    href: "/schedule",
    ctaKey: "guide.navCalendar",
    searchTags: ["grafik", "kalendarz", "miesiąc", "terminarz"],
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
    searchTags: ["zespół", "grafik osoby", "urlop", "wyjątek"],
    blocks: [
      { type: "lead", key: "guide.hcStaffScheduleLead" },
      { type: "steps", key: "guide.hcStaffScheduleSteps" },
    ],
  }),
  S({
    id: "appointments-list",
    category: "appointments",
    titleKey: "guide.hcApptListTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wizyty", "lista", "filtr", "status"],
    blocks: [
      { type: "lead", key: "guide.hcApptListLead" },
      { type: "bullets", key: "guide.hcApptStatuses" },
      { type: "steps", key: "guide.hcApptListSteps" },
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
    ],
  }),
  S({
    id: "appointments-client-change",
    category: "appointments",
    titleKey: "guide.hcClientChangeTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["prośba klienta", "zmiana terminu", "confirm"],
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
    searchTags: ["anuluj", "anulowana"],
    blocks: [
      { type: "lead", key: "guide.hcCancelLead" },
      { type: "steps", key: "guide.hcCancelSteps" },
    ],
  }),
  S({
    id: "day-plan",
    category: "appointments",
    titleKey: "guide.modDayplanTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    searchTags: ["plan dnia", "dziś"],
    blocks: [
      { type: "lead", key: "guide.hcDayplanLead" },
      { type: "steps", key: "guide.hcDayplanSteps" },
    ],
  }),
  S({
    id: "reminders-settings",
    category: "notifications",
    titleKey: "guide.hcRemindersTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["przypomnienia", "24h", "sms", "email"],
    blocks: [
      { type: "lead", key: "guide.hcRemindersLead" },
      { type: "body", key: "guide.hcRemindersBody" },
    ],
  }),
  S({
    id: "messages-templates",
    category: "notifications",
    titleKey: "guide.modMsgsTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["szablony", "wiadomości", "sms"],
    blocks: [
      { type: "lead", key: "guide.hcMsgsLead" },
      { type: "steps", key: "guide.hcMsgsSteps" },
    ],
  }),
  S({
    id: "messages-history",
    category: "notifications",
    titleKey: "guide.hcMsgHistoryTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["historia wysyłek", "log"],
    blocks: [
      { type: "lead", key: "guide.hcMsgHistoryLead" },
      { type: "bullets", key: "guide.hcMsgHistoryBullets" },
    ],
  }),
  S({
    id: "booking-link",
    category: "booking",
    titleKey: "guide.hcBookingLinkTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["link", "rezerwacje", "slug", "qr"],
    blocks: [
      { type: "lead", key: "guide.hcBookingLinkLead" },
      { type: "steps", key: "guide.hcBookingLinkSteps" },
      { type: "body", key: "guide.modBookingSourceOnline" },
      { type: "body", key: "guide.modBookingSourceManual" },
    ],
  }),
  S({
    id: "booking-public-flow",
    category: "booking",
    titleKey: "guide.modBookingTitle",
    ctaKey: "guide.navBooking",
    searchTags: ["rezerwacja online", "klient", "usługa", "termin"],
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
    searchTags: ["confirm", "potwierdź", "klient"],
    blocks: [
      { type: "lead", key: "guide.modManageLead" },
      { type: "bullets", key: "guide.modManageFlow" },
      { type: "steps", key: "guide.modManageSteps" },
    ],
  }),
  S({
    id: "billing-trial",
    category: "billing",
    titleKey: "guide.hcBillingTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["trial", "stripe", "subskrypcja", "płatność"],
    blocks: [
      { type: "lead", key: "guide.hcBillingLead" },
      { type: "bullets", key: "guide.hcBillingBullets" },
      { type: "steps", key: "guide.hcBillingSteps" },
    ],
  }),
  S({
    id: "team-members",
    category: "team",
    titleKey: "guide.modTeamTitle",
    href: "/team",
    ctaKey: "guide.navTeam",
    searchTags: ["zespół", "zaproszenie", "usługi"],
    blocks: [
      { type: "lead", key: "guide.modTeamLead" },
      { type: "steps", key: "guide.modTeamSteps" },
      { type: "lead", key: "guide.modRolesTitle" },
      { type: "bullets", key: "guide.modRolesBullets" },
    ],
  }),
  S({
    id: "services",
    category: "team",
    titleKey: "guide.modServicesTitle",
    href: "/services",
    ctaKey: "guide.navServices",
    searchTags: ["usługi", "cena", "czas trwania"],
    blocks: [
      { type: "lead", key: "guide.modServicesLead" },
      { type: "steps", key: "guide.modServicesSteps" },
      { type: "lead", key: "guide.modServicesHoursTitle" },
      { type: "steps", key: "guide.modServicesHoursSteps" },
    ],
  }),
  S({
    id: "business-settings",
    category: "other",
    titleKey: "guide.modBusinessTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["ustawienia", "firma", "nip"],
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
    searchTags: ["klienci", "notatki", "kontakt"],
    blocks: [
      { type: "lead", key: "guide.hcClientsLead" },
      { type: "tip", key: "guide.hcClientsTip" },
    ],
  }),
  S({
    id: "slots-logic",
    category: "other",
    titleKey: "guide.modSlotsTitle",
    searchTags: ["slot", "zajęty", "termin"],
    blocks: [
      { type: "lead", key: "guide.hcSlotsLead" },
      { type: "body", key: "guide.hcSlotsBlocking" },
      { type: "body", key: "guide.hcSlotsNonBlocking" },
    ],
  }),
  S({
    id: "help-support",
    category: "other",
    titleKey: "guide.modHelpTitle",
    href: "/help",
    ctaKey: "guide.navHelp",
    searchTags: ["pomoc", "support", "czat"],
    blocks: [
      { type: "lead", key: "guide.modHelpLead" },
      { type: "bullets", key: "guide.modHelpBullets" },
    ],
  }),
  S({
    id: "export-csv",
    category: "other",
    titleKey: "guide.hcExportTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["csv", "eksport"],
    blocks: [
      { type: "lead", key: "guide.hcExportLead" },
      { type: "steps", key: "guide.hcExportSteps" },
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
] as const
