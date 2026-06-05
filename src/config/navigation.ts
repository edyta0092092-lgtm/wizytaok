import {
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  LifeBuoy,
  MessageSquare,
  Settings,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  icon: LucideIcon
  /** Klucz tłumaczenia w `dictionaries` (np. navigation.dashboard). */
  labelKey: string
}

/** Kolejność: Plan dnia → Wizyty → Grafik → Statystyki → Klienci → Usługi → Zespół → Dostępność → Wiadomości → Ustawienia → Pomoc. Przewodnik: link z Pozycji Pomocy (`/guide`). */
const adminNav: NavItem[] = [
  { href: "/dashboard", icon: Calendar, labelKey: "navigation.dashboard" },
  { href: "/appointments", icon: CalendarDays, labelKey: "navigation.appointments" },
  { href: "/schedule", icon: CalendarRange, labelKey: "navigation.schedule" },
  { href: "/statystyki", icon: BarChart3, labelKey: "navigation.statistics" },
  { href: "/klienci", icon: Users, labelKey: "navigation.clients" },
  { href: "/services", icon: ClipboardList, labelKey: "navigation.services" },
  { href: "/team", icon: BriefcaseBusiness, labelKey: "navigation.team" },
  { href: "/availability", icon: CalendarClock, labelKey: "navigation.availability" },
  { href: "/messages", icon: MessageSquare, labelKey: "navigation.messages" },
  { href: "/settings", icon: Settings, labelKey: "navigation.settings" },
  { href: "/account", icon: UserCircle, labelKey: "navigation.myAccount" },
  { href: "/help", icon: LifeBuoy, labelKey: "navigation.help" },
]

/** Plan dnia, wizyty, grafik, statystyki, klienci i wiadomości — jak u administratora firmy. */
const staffNav: NavItem[] = [
  { href: "/dashboard", icon: Calendar, labelKey: "navigation.dashboard" },
  { href: "/appointments", icon: CalendarDays, labelKey: "navigation.appointments" },
  { href: "/schedule", icon: CalendarRange, labelKey: "navigation.schedule" },
  { href: "/statystyki", icon: BarChart3, labelKey: "navigation.statistics" },
  { href: "/klienci", icon: Users, labelKey: "navigation.clients" },
  { href: "/messages", icon: MessageSquare, labelKey: "navigation.messageLog" },
  { href: "/settings", icon: Settings, labelKey: "navigation.settings" },
  { href: "/help", icon: LifeBuoy, labelKey: "navigation.help" },
  { href: "/account", icon: UserCircle, labelKey: "navigation.myAccount" },
]

/** Nawigacja w panelu wg roli efektywnej (admin vs pracownik). */
export function getAppNavForRole(effectiveRole: "admin" | "staff" | null): NavItem[] {
  if (effectiveRole === "staff") return staffNav
  return adminNav
}
