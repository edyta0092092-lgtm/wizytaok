/** Centralna konfiguracja kroków onboarding (kolejność, trasy, cele data-tour). */

export type TourStepConfig = {
  id: string
  path: string
  /** Wartość `data-tour` lub null przy ekranie końcowym */
  target: string | null
}

/**
 * 10 kroków: 1-9 podświetlenia, krok 10 - ekran końcowy (target null).
 */
export const TOUR_STEPS: TourStepConfig[] = [
  { id: "settings-company", path: "/settings", target: "settings-company" },
  { id: "settings-reminders", path: "/settings", target: "settings-reminders" },
  { id: "clients-add", path: "/clients", target: "clients-add" },
  { id: "appointments-add", path: "/appointments", target: "appointments-add" },
  { id: "dashboard-today", path: "/dashboard", target: "dashboard-today" },
  { id: "appointments-statuses", path: "/appointments", target: "appointments-statuses" },
  { id: "dashboard-attention", path: "/dashboard", target: "dashboard-attention" },
  { id: "messages-list", path: "/messages", target: "messages-list" },
  { id: "clients-risk", path: "/clients", target: "clients-risk" },
  { id: "finale", path: "/dashboard", target: null },
]
