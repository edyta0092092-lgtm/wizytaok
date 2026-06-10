import {
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CreditCard,
  Globe,
  LifeBuoy,
  MessageSquare,
  type LucideIcon,
} from "lucide-react"

import type { BusinessAccessContextValue } from "@/lib/auth/business-access-context"

export type SettingsMobileNavItem = {
  href: string
  icon: LucideIcon
  labelKey: string
  visible?: (access: BusinessAccessContextValue) => boolean
}

export const settingsMobileNavItems: SettingsMobileNavItem[] = [
  {
    href: "/settings/business",
    icon: Building2,
    labelKey: "settings.mobileSectionBusiness",
    visible: (access) => access.canManageSettings,
  },
  {
    href: "/settings/booking",
    icon: Globe,
    labelKey: "settings.mobileSectionBooking",
    visible: (access) => access.canManageSettings,
  },
  {
    href: "/availability",
    icon: CalendarClock,
    labelKey: "settings.mobileSectionHours",
    visible: (access) => access.canManageAvailability,
  },
  {
    href: "/team",
    icon: BriefcaseBusiness,
    labelKey: "settings.mobileSectionTeam",
    visible: (access) => access.canManageTeam,
  },
  {
    href: "/settings/subscription",
    icon: CreditCard,
    labelKey: "settings.mobileSectionSubscription",
    visible: (access) => access.isOwner || access.effectiveRole === "admin",
  },
  {
    href: "/settings/notifications",
    icon: MessageSquare,
    labelKey: "settings.mobileSectionNotifications",
    visible: (access) => access.canManageSettings,
  },
  {
    href: "/help",
    icon: LifeBuoy,
    labelKey: "settings.mobileSectionHelp",
  },
]

export function getSettingsMobileNavItemsForAccess(
  access: BusinessAccessContextValue,
): SettingsMobileNavItem[] {
  if (!access.ready) {
    return settingsMobileNavItems.filter((item) => !item.visible)
  }
  return settingsMobileNavItems.filter((item) => !item.visible || item.visible(access))
}
