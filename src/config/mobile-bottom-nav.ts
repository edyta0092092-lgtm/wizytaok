import {
  CalendarDays,
  Ellipsis,
  MessageSquare,
  Sun,
  Users,
} from "lucide-react"

import type { NavItem } from "@/config/navigation"

/** Główne sekcje panelu na mobile (dolna nawigacja, 5 zakładek). */
export const mobileBottomNavItems: NavItem[] = [
  { href: "/dashboard", icon: Sun, labelKey: "navigation.today" },
  { href: "/appointments", icon: CalendarDays, labelKey: "navigation.appointments" },
  { href: "/klienci", icon: Users, labelKey: "navigation.clients" },
  { href: "/messages", icon: MessageSquare, labelKey: "navigation.messages" },
  { href: "/more", icon: Ellipsis, labelKey: "navigation.more" },
]
