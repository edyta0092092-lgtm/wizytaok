"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { HelpCircle, LifeBuoy, MessageCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { useTranslations } from "@/lib/i18n/use-translations"

const HIDE_PREFIXES = ["/rezerwacje/", "/book/", "/confirm/"]
const PANEL_PREFIXES = [
  "/dashboard",
  "/appointments",
  "/schedule",
  "/statystyki",
  "/services",
  "/team",
  "/availability",
  "/klienci",
  "/messages",
  "/settings",
  "/account",
  "/guide",
  "/help",
]

export function HelpFloatingWidget() {
  const { t } = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)")
    const apply = () => setIsMobile(media.matches)
    apply()
    const handler = () => apply()
    media.addEventListener("change", handler)
    return () => media.removeEventListener("change", handler)
  }, [])

  const shouldHide = React.useMemo(() => {
    if (!pathname) return true
    if (HIDE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true
    return !PANEL_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }, [pathname])

  if (shouldHide) return null

  const openHelp = () => {
    if (isMobile) {
      router.push("/help")
      return
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        title={t("navigation.help")}
        aria-label={t("navigation.help")}
        onClick={openHelp}
        className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] right-4 z-40 inline-flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg shadow-slate-900/15 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:bottom-5 lg:right-5 lg:size-11"
      >
        <HelpCircle className="size-5" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full border-border p-0 sm:max-w-sm">
          <Card className="h-full rounded-none border-0 shadow-none">
            <CardHeader>
              <CardTitle>{t("help.widgetTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link href="/help" onClick={() => setOpen(false)}>
                  <MessageCircle className="size-4" aria-hidden />
                  {t("help.supportChatTitle")}
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start gap-2">
                <Link href="/guide" onClick={() => setOpen(false)}>
                  <LifeBuoy className="size-4" aria-hidden />
                  {t("help.openGuide")}
                </Link>
              </Button>
            </CardContent>
          </Card>
        </SheetContent>
      </Sheet>
    </>
  )
}
