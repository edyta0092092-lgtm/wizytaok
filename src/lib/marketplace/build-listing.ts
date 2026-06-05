import { inferCategoryIdsFromText } from "@/lib/marketplace/categories"
import { extractCityFromAddress } from "@/lib/marketplace/extract-city"
import type { MarketplaceListing, MarketplaceServicePreview } from "@/lib/marketplace/types"

type BusinessRow = {
  id: string
  business_name: string
  slug: string
  business_address: string | null
  phone: string | null
  contact_phone: string | null
}

export function buildListingDescription(
  businessName: string,
  services: MarketplaceServicePreview[],
): string {
  const firstDesc = services.find((s) => s.description?.trim())?.description?.trim()
  if (firstDesc) return firstDesc.slice(0, 240)
  if (services.length > 0) {
    const names = services
      .slice(0, 3)
      .map((s) => s.name)
      .join(", ")
    return `${businessName} — ${names}`
  }
  return businessName
}

export function buildMarketplaceListing(
  business: BusinessRow,
  services: MarketplaceServicePreview[],
): MarketplaceListing {
  const serviceText = services.map((s) => `${s.name} ${s.description ?? ""}`).join(" ")
  const categoryIds = inferCategoryIdsFromText(`${business.business_name} ${serviceText}`)
  const phone =
    (business.contact_phone?.trim() || business.phone?.trim() || null) ?? null

  return {
    id: business.id,
    slug: business.slug.trim().toLowerCase(),
    name: business.business_name.trim(),
    description: buildListingDescription(business.business_name, services),
    city: extractCityFromAddress(business.business_address),
    address: business.business_address?.trim() || null,
    phone,
    categoryIds,
    services,
  }
}
