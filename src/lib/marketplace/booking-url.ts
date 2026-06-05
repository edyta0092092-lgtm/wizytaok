export function marketplaceBookingUrl(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/rezerwacje/${encodeURIComponent(normalized)}`
}

export function marketplaceCompanyProfilePath(slug: string): string {
  const normalized = slug.trim().toLowerCase()
  return `/public/company/${encodeURIComponent(normalized)}`
}
