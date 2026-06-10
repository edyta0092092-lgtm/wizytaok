"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { getSettingsMobileNavItemsForAccess } from "@/config/settings-mobile-nav"
import { useBusinessAccess } from "@/lib/auth/business-access-context"
import { useTranslations } from "@/lib/i18n/use-translations"
import { cn } from "@/lib/utils"

export function SettingsMobileMenu() {
  const pathname = usePathname()
  const access = useBusinessAccess()
  const { t } = useTranslations()
  const items = getSettingsMobileNavItemsForAccess(access)

  return (
    <nav aria-label={t("settings.mobileMenuAria")}>
      <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm shadow-slate-900/5">
        {items.map((item, index) => {
          const active =
            pathname === item.href ||
            (item.href.startsWith("/settings/") && pathname.startsWith(`${item.href}`))
          const Icon = item.icon
          return (
            <li key={item.href} className={cn(index > 0 && "border-t border-border/80")}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-[3.25rem] touch-manipulation items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[color:var(--nav-active-bg)] text-primary"
                    : "text-foreground hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                    active
                      ? "border-primary/20 bg-card text-primary"
                      : "border-border/80 bg-muted/30 text-muted-foreground",
                  )}
                >
                  <Icon className="size-[1.125rem]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">{t(item.labelKey)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
