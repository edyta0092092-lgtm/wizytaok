/** Sekcje rozwijane w przewodniku — klucze tłumaczeń w `guide.*`. */

export type GuideReferenceBlock =
  | { type: "lead"; key: string }
  | { type: "body"; key: string }
  | { type: "bullets"; key: string }
  | { type: "steps"; key: string }
  | { type: "tip"; key: string }

export type GuideReferenceSection = {
  id: string
  titleKey: string
  href?: string
  ctaKey?: string
  searchTags: string[]
  blocks: GuideReferenceBlock[]
}

export const GUIDE_REFERENCE_SECTIONS: GuideReferenceSection[] = [
  {
    id: "business",
    titleKey: "guide.modBusinessTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["ustawienia", "firma", "nip", "slug", "settings"],
    blocks: [
      { type: "lead", key: "guide.modBusinessLead" },
      { type: "bullets", key: "guide.modBusinessBullets" },
      { type: "steps", key: "guide.modBusinessSteps" },
      { type: "tip", key: "guide.modBusinessTip" },
    ],
  },
  {
    id: "services",
    titleKey: "guide.modServicesTitle",
    href: "/services",
    ctaKey: "guide.navServices",
    searchTags: ["usługi", "cena", "godziny", "services"],
    blocks: [
      { type: "lead", key: "guide.modServicesLead" },
      { type: "body", key: "guide.modServicesExplain" },
      { type: "steps", key: "guide.modServicesSteps" },
      { type: "lead", key: "guide.modServicesHoursTitle" },
      { type: "body", key: "guide.modServicesHoursLead" },
      { type: "steps", key: "guide.modServicesHoursSteps" },
    ],
  },
  {
    id: "availability",
    titleKey: "guide.modAvailTitle",
    href: "/availability",
    ctaKey: "guide.navAvailability",
    searchTags: ["dostępność", "godziny", "wyjątki", "święta", "availability"],
    blocks: [
      { type: "lead", key: "guide.modAvailLead" },
      { type: "body", key: "guide.modAvailCalendarInfo" },
      { type: "bullets", key: "guide.modAvailBullets" },
      { type: "steps", key: "guide.modAvailSteps" },
      { type: "lead", key: "guide.modAvailExTitle" },
      { type: "body", key: "guide.modAvailExLead" },
      { type: "steps", key: "guide.modAvailExSteps" },
      { type: "tip", key: "guide.modAvailExExample" },
    ],
  },
  {
    id: "availability-logic",
    titleKey: "guide.availabilityLogicTitle",
    searchTags: ["terminy", "sloty", "logika"],
    blocks: [
      { type: "lead", key: "guide.availabilityLogicLead" },
      { type: "bullets", key: "guide.availabilityLogicRules" },
    ],
  },
  {
    id: "team",
    titleKey: "guide.modTeamTitle",
    href: "/team",
    ctaKey: "guide.navTeam",
    searchTags: ["zespół", "zaproszenie", "grafik", "team"],
    blocks: [
      { type: "lead", key: "guide.modTeamLead" },
      { type: "bullets", key: "guide.modTeamBullets" },
      { type: "steps", key: "guide.modTeamSteps" },
      { type: "lead", key: "guide.modRolesTitle" },
      { type: "body", key: "guide.modRolesLead" },
      { type: "bullets", key: "guide.modRolesBullets" },
      { type: "steps", key: "guide.modRolesSteps" },
    ],
  },
  {
    id: "booking",
    titleKey: "guide.modBookingTitle",
    ctaKey: "guide.navBooking",
    searchTags: ["rezerwacja", "online", "link", "booking"],
    blocks: [
      { type: "lead", key: "guide.modBookingLead" },
      { type: "bullets", key: "guide.modBookingFlow" },
      { type: "steps", key: "guide.modBookingSteps" },
      { type: "tip", key: "guide.modBookingTip" },
      { type: "body", key: "guide.modBookingSourceOnline" },
      { type: "body", key: "guide.modBookingSourceManual" },
    ],
  },
  {
    id: "dayplan",
    titleKey: "guide.modDayplanTitle",
    href: "/dashboard",
    ctaKey: "guide.navDashboard",
    searchTags: ["plan dnia", "dashboard", "dziś"],
    blocks: [
      { type: "lead", key: "guide.modDayplanLead" },
      { type: "bullets", key: "guide.modDayplanBullets" },
      { type: "steps", key: "guide.modDayplanSteps" },
    ],
  },
  {
    id: "appointments",
    titleKey: "guide.modApptTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["wizyty", "status", "filtr", "appointments"],
    blocks: [
      { type: "lead", key: "guide.modApptLead" },
      { type: "body", key: "guide.modApptBookingSource" },
      { type: "bullets", key: "guide.modApptStatuses" },
      { type: "body", key: "guide.modApptStatusNote" },
      { type: "steps", key: "guide.modApptSteps" },
    ],
  },
  {
    id: "schedule",
    titleKey: "guide.modScheduleTitle",
    href: "/schedule",
    ctaKey: "guide.navCalendar",
    searchTags: ["grafik", "kalendarz", "schedule", "miesiąc"],
    blocks: [
      { type: "lead", key: "guide.modScheduleLead" },
      { type: "bullets", key: "guide.modScheduleBullets" },
      { type: "steps", key: "guide.modScheduleSteps" },
    ],
  },
  {
    id: "changes",
    titleKey: "guide.modChangesTitle",
    href: "/appointments",
    ctaKey: "guide.navAppointments",
    searchTags: ["zmiana", "prośba", "reschedule"],
    blocks: [
      { type: "lead", key: "guide.modChangesLead" },
      { type: "steps", key: "guide.modChangesSteps" },
    ],
  },
  {
    id: "needs-action",
    titleKey: "guide.modNeedsActionTitle",
    href: "/appointments?filter=needs_action",
    ctaKey: "guide.navAppointments",
    searchTags: ["wymaga reakcji", "needs action"],
    blocks: [
      { type: "lead", key: "guide.modNeedsActionLead" },
      { type: "bullets", key: "guide.modNeedsActionBullets" },
    ],
  },
  {
    id: "reminders",
    titleKey: "guide.modRemindersTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["przypomnienia", "sms", "email", "24h"],
    blocks: [
      { type: "lead", key: "guide.modRemindersLead" },
      { type: "body", key: "guide.modRemindersBody" },
    ],
  },
  {
    id: "messages",
    titleKey: "guide.modMsgsTitle",
    href: "/messages",
    ctaKey: "guide.navMessages",
    searchTags: ["wiadomości", "szablony", "historia", "messages"],
    blocks: [
      { type: "lead", key: "guide.modMsgsLead" },
      { type: "steps", key: "guide.modMsgsSteps" },
      { type: "tip", key: "guide.modMsgsMvp" },
    ],
  },
  {
    id: "manage-page",
    titleKey: "guide.modManageTitle",
    searchTags: ["confirm", "klient", "anuluj", "potwierdź"],
    blocks: [
      { type: "lead", key: "guide.modManageLead" },
      { type: "bullets", key: "guide.modManageFlow" },
      { type: "steps", key: "guide.modManageSteps" },
    ],
  },
  {
    id: "clients",
    titleKey: "guide.modClientsTitle",
    href: "/clients",
    ctaKey: "guide.navClients",
    searchTags: ["klienci", "notatki", "ryzyko", "clients"],
    blocks: [
      { type: "lead", key: "guide.modClientsLead" },
      { type: "body", key: "guide.modClientsFoot" },
    ],
  },
  {
    id: "slots",
    titleKey: "guide.modSlotsTitle",
    searchTags: ["slot", "zajęty", "blokada"],
    blocks: [
      { type: "lead", key: "guide.modSlotsLead" },
      { type: "body", key: "guide.modSlotsBlocking" },
      { type: "body", key: "guide.modSlotsNonBlocking" },
    ],
  },
  {
    id: "settings-extra",
    titleKey: "guide.modSettingsExtraTitle",
    href: "/settings",
    ctaKey: "guide.navSettings",
    searchTags: ["csv", "eksport", "depozyt", "stripe", "trial"],
    blocks: [
      { type: "lead", key: "guide.modSettingsExtraLead" },
      { type: "bullets", key: "guide.modSettingsExtraBullets" },
      { type: "steps", key: "guide.modSettingsExtraSteps" },
      { type: "lead", key: "guide.modSettingsGuideTitle" },
      { type: "body", key: "guide.modSettingsGuideLead" },
    ],
  },
  {
    id: "help",
    titleKey: "guide.modHelpTitle",
    href: "/help",
    ctaKey: "guide.navHelp",
    searchTags: ["pomoc", "support", "czat"],
    blocks: [
      { type: "lead", key: "guide.modHelpLead" },
      { type: "bullets", key: "guide.modHelpBullets" },
    ],
  },
  {
    id: "legal",
    titleKey: "guide.modLaunchLegalTitle",
    searchTags: ["regulamin", "prawne", "terms"],
    blocks: [
      { type: "lead", key: "guide.modLaunchLegalLead" },
      { type: "bullets", key: "guide.modLaunchLegalBullets" },
      { type: "steps", key: "guide.modLaunchLegalSteps" },
    ],
  },
]

export const GUIDE_PLAYBOOK_MODULES = [
  { id: "pb-dashboard", titleKey: "guide.modDayplanTitle", leadKey: "guide.modDayplanLead", href: "/dashboard", ctaKey: "guide.navDashboard" },
  { id: "pb-appt", titleKey: "guide.modApptTitle", leadKey: "guide.modApptLead", href: "/appointments", ctaKey: "guide.navAppointments" },
  { id: "pb-schedule", titleKey: "guide.modScheduleTitle", leadKey: "guide.modScheduleLead", href: "/schedule", ctaKey: "guide.navCalendar" },
  { id: "pb-clients", titleKey: "guide.modClientsTitle", leadKey: "guide.modClientsLead", href: "/clients", ctaKey: "guide.navClients" },
  { id: "pb-business", titleKey: "guide.modBusinessTitle", leadKey: "guide.modBusinessLead", href: "/settings", ctaKey: "guide.navSettings" },
  { id: "pb-services", titleKey: "guide.modServicesTitle", leadKey: "guide.modServicesLead", href: "/services", ctaKey: "guide.navServices" },
  { id: "pb-avail", titleKey: "guide.modAvailTitle", leadKey: "guide.modAvailLead", href: "/availability", ctaKey: "guide.navAvailability" },
  { id: "pb-team", titleKey: "guide.modTeamTitle", leadKey: "guide.modTeamLead", href: "/team", ctaKey: "guide.navTeam" },
  {
    id: "pb-booking",
    titleKey: "guide.modBookingTitle",
    leadKey: "guide.modBookingLead",
    href: "booking" as const,
    ctaKey: "guide.navBooking",
  },
  { id: "pb-msgs", titleKey: "guide.modMsgsTitle", leadKey: "guide.modMsgsLead", href: "/messages", ctaKey: "guide.navMessages" },
  { id: "pb-help", titleKey: "guide.modHelpTitle", leadKey: "guide.modHelpLead", href: "/help", ctaKey: "guide.navHelp" },
] as const

export const GUIDE_FAQ_KEYS = [
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
