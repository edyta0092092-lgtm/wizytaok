"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, CalendarDays, History, LogOut, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getBrowserClient } from "@/lib/supabase/client"
import { useTranslations } from "@/lib/i18n/use-translations"

const NAV: Array<{
  href: string
  labelKey: string
  icon: typeof CalendarDays
  exact?: boolean
}> = [
  { href: "/konto", labelKey: "clientPortal.navDashboard", icon: CalendarDays, exact: true },
  { href: "/konto/wizyty", labelKey: "clientPortal.navAppointments", icon: CalendarDays },
  { href: "/konto/historia", labelKey: "clientPortal.navHistory", icon: History },
  { href: "/konto/profil", labelKey: "clientPortal.navProfile", icon: User },
  { href: "/konto/powiadomienia", labelKey: "clientPortal.navNotifications", icon: Bell },
]

export function ClientPortalShell({
  children,
  title,
}: {
  children: React.ReactNode
  title?: string
}) {
  const { t } = useTranslations()
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    const client = getBrowserClient()
    if (client) await client.auth.signOut()
    router.replace("/konto/logowanie")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              WizytaOK
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              {title ?? t("clientPortal.portalTitle")}
            </h1>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void logout()}>
            <LogOut className="mr-1.5 size-4" aria-hidden />
            {t("clientPortal.logout")}
          </Button>
        </div>
        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-4 pb-3">
          {NAV.map(({ href, labelKey, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {t(labelKey)}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}
