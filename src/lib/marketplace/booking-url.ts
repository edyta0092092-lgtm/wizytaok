import { businessBookingPagePath } from "@/lib/business/booking-page-path"

export function marketplaceBookingUrl(slug: string): string {
  return businessBookingPagePath(slug)
}

export function marketplaceCompanyProfilePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/public/company/${encodeURIComponent(normalized)}`
}
