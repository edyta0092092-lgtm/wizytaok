"use client"

import Link from "next/link"
import { Clock, MapPin, Phone, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { marketplaceBookingUrl } from "@/lib/marketplace/booking-url"
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories"
import type { MarketplaceCompanyProfile } from "@/lib/marketplace/types"
import { useTranslations } from "@/lib/i18n/use-translations"

const WEEKDAY_KEYS = [
  "weekdaySun",
  "weekdayMon",
  "weekdayTue",
  "weekdayWed",
  "weekdayThu",
  "weekdayFri",
  "weekdaySat",
] as const

export function MarketplaceCompanyProfileView({ profile }: { profile: MarketplaceCompanyProfile }) {
  const { t } = useTranslations()
  const category = (key: string) => t(`marketplacePanel.${key}`)
  const weekday = (key: (typeof WEEKDAY_KEYS)[number]) => t(`marketplacePanel.${key}`)

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border/80 bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Link href="/szukaj" className="text-sm text-primary hover:underline">
            ← {t("marketplacePanel.backToSearch")}
          </Link>
          <div className="mt-4 flex flex-wrap gap-2">
            {profile.categoryIds.map((id) => {
              const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === id)
              return (
                <Badge key={id} variant="secondary" className="rounded-md">
                  {category(cat?.labelKey ?? "categoryOther")}
                </Badge>
              )
            })}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{profile.name}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">{profile.description}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {profile.address ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden />
                {profile.address}
              </span>
            ) : null}
            {profile.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" aria-hidden />
                {profile.phone}
              </span>
            ) : null}
          </div>
          <Button asChild size="lg" className="mt-6 rounded-xl">
            <Link href={marketplaceBookingUrl(profile.slug)}>
              {t("marketplacePanel.bookAppointment")}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("marketplacePanel.profileServices")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {profile.services.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground tabular-nums">
                    {s.durationMinutes} min · {s.price} {s.currency}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="size-4 text-primary" aria-hidden />
            <CardTitle className="text-base">{t("marketplacePanel.profileTeam")}</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {profile.staff.map((member) => (
                  <li key={member.id}>
                    <span className="font-medium">{member.name}</span>
                    {member.role ? (
                      <span className="text-muted-foreground"> · {member.role}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="size-4 text-primary" aria-hidden />
            <CardTitle className="text-base">{t("marketplacePanel.profileHours")}</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.openingHours.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {profile.openingHours.map((row) => (
                  <li key={row.weekday} className="flex justify-between gap-3">
                    <span>{weekday(WEEKDAY_KEYS[row.weekday] ?? "weekdayMon")}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {row.isOpen
                        ? `${row.startTime} – ${row.endTime}`
                        : t("marketplacePanel.closed")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
