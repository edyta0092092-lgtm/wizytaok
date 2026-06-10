import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  CreditCard,
  LifeBuoy,
  Settings,
  UserCircle,
  type LucideIcon,
} from "lucide-react"

import type { BusinessAccessContextValue } from "@/lib/auth/business-access-context"

export type MobileMoreNavItem = {
  href: string
  icon: LucideIcon
  labelKey: string
  visible?: (access: BusinessAccessContextValue) => boolean
}

/** Pozycje menu „Więcej” — filtrowane wg uprawnień (jak w panelu desktop). */
export const mobileMoreNavItems: MobileMoreNavItem[] = [
  { href: "/schedule", icon: CalendarRange, labelKey: "navigation.schedule" },
  {
    href: "/services",
    icon: ClipboardList,
    labelKey: "navigation.services",
    visible: (access) => access.canManageServices,
  },
  {
    href: "/team",
    icon: BriefcaseBusiness,
    labelKey: "navigation.team",
    visible: (access) => access.canManageTeam,
  },
  {
    href: "/availability",
    icon: CalendarClock,
    labelKey: "navigation.availability",
    visible: (access) => access.canManageAvailability,
  },
  { href: "/statystyki", icon: BarChart3, labelKey: "navigation.statistics" },
  {
    href: "/settings",
    icon: Settings,
    labelKey: "navigation.settings",
    visible: (access) => access.canManageSettings,
  },
  {
    href: "/activate-access",
    icon: CreditCard,
    labelKey: "more.subscription",
    visible: (access) => access.isOwner || access.effectiveRole === "admin",
  },
  { href: "/help", icon: LifeBuoy, labelKey: "navigation.help" },
  { href: "/account", icon: UserCircle, labelKey: "navigation.myAccount" },
]

export function getMobileMoreNavItemsForAccess(
  access: BusinessAccessContextValue,
): MobileMoreNavItem[] {
  if (!access.ready) return mobileMoreNavItems.filter((item) => !item.visible)
  return mobileMoreNavItems.filter((item) => !item.visible || item.visible(access))
}
