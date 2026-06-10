"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { mobileBottomNavItems } from "@/config/mobile-bottom-nav"
import { isMobileBottomNavActive } from "@/lib/navigation/mobile-nav-active"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useTranslations()

  return (
    <nav
      className="w-full border-t border-border/80 bg-card/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label={t("pwa.bottomNavAria")}
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 gap-0 px-0.5 pt-1">
        {mobileBottomNavItems.map((item) => {
          const active = isMobileBottomNavActive(pathname ?? "", item.href)
          const Icon = item.icon
          const label = t(item.labelKey)
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-[3.25rem] touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[0.6rem] font-medium leading-tight transition-colors sm:px-1 sm:text-[0.65rem]",
                  active
                    ? "text-teal-700 dark:text-teal-200"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-2xl transition-colors",
                    active
                      ? "bg-teal-500/15 text-teal-700 ring-1 ring-teal-500/25 dark:text-teal-100"
                      : "bg-transparent"
                  )}
                >
                  <Icon className="size-[1.125rem]" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
                </span>
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
