/** Centralna konfiguracja kroków onboarding (kolejność, trasy, cele data-tour). */

export type TourStepConfig = {
  id: string
  path: string
  /** Wartość `data-tour` lub null przy ekranie końcowym */
  target: string | null
}

/**
 * 9 kroków: 1-8 podświetlenia, krok 9 - ekran końcowy (target null).
 */
export const TOUR_STEPS: TourStepConfig[] = [
  { id: "settings-company", path: "/settings", target: "settings-company" },
  { id: "messages-templates", path: "/messages", target: "messages-templates" },
  { id: "clients-add", path: "/clients", target: "clients-add" },
  { id: "dashboard-today", path: "/dashboard", target: "dashboard-today" },
  { id: "appointments-statuses", path: "/appointments", target: "appointments-statuses" },
  { id: "schedule-month", path: "/schedule", target: "schedule-month" },
  { id: "messages-list", path: "/messages", target: "messages-list" },
  { id: "finale", path: "/dashboard", target: null },
]
