import Link from "next/link"
import { MapPin, Phone } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { marketplaceBookingUrl, marketplaceCompanyProfilePath } from "@/lib/marketplace/booking-url"
import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace/categories"
import type { MarketplaceListing } from "@/lib/marketplace/types"

export function MarketplaceCompanyCard({
  listing,
  categoryLabel,
  bookLabel,
  profileLabel,
}: {
  listing: MarketplaceListing
  categoryLabel: (id: string) => string
  bookLabel: string
  profileLabel: string
}) {
  const topServices = listing.services.slice(0, 4)

  return (
    <Card className="flex h-full flex-col rounded-2xl border border-border/80 shadow-sm">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap gap-1.5">
          {listing.categoryIds.slice(0, 2).map((id) => {
            const cat = MARKETPLACE_CATEGORIES.find((c) => c.id === id)
            return (
              <Badge key={id} variant="secondary" className="rounded-md text-[0.625rem]">
                {categoryLabel(cat?.labelKey ?? "categoryOther")}
              </Badge>
            )
          })}
        </div>
        <CardTitle className="text-base leading-snug">
          <Link
            href={marketplaceCompanyProfilePath(listing.slug)}
            className="hover:text-primary hover:underline"
          >
            {listing.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <p className="line-clamp-3 text-muted-foreground leading-relaxed">{listing.description}</p>
        {listing.city || listing.address ? (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {[listing.city, listing.address].filter(Boolean).join(" · ")}
            </span>
          </p>
        ) : null}
        {listing.phone ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden />
            {listing.phone}
          </p>
        ) : null}
        <ul className="space-y-1 text-xs">
          {topServices.map((s) => (
            <li key={s.id} className="text-foreground/90">
              {s.name}
              <span className="text-muted-foreground">
                {" "}
                · {s.durationMinutes} min
              </span>
            </li>
          ))}
          {listing.services.length > 4 ? (
            <li className="text-muted-foreground">+{listing.services.length - 4}</li>
          ) : null}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button asChild size="sm" className="rounded-xl">
          <Link href={marketplaceBookingUrl(listing.slug)}>{bookLabel}</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link href={marketplaceCompanyProfilePath(listing.slug)}>{profileLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
