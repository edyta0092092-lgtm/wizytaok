import { Calendar, CalendarDays, CalendarRange, Users } from "lucide-react"

import type { NavItem } from "@/config/navigation"

/** Główne sekcje panelu na mobile (dolna nawigacja). */
export const mobileBottomNavItems: NavItem[] = [
  { href: "/dashboard", icon: Calendar, labelKey: "navigation.dashboard" },
  { href: "/appointments", icon: CalendarDays, labelKey: "navigation.appointments" },
  { href: "/schedule", icon: CalendarRange, labelKey: "navigation.schedule" },
  { href: "/klienci", icon: Users, labelKey: "navigation.clients" },
]
