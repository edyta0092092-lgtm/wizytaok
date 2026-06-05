export type MarketplaceServicePreview = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  price: number
  currency: string
}

export type MarketplaceListing = {
  id: string
  slug: string
  name: string
  description: string
  city: string | null
  address: string | null
  phone: string | null
  categoryIds: string[]
  services: MarketplaceServicePreview[]
}

export type MarketplaceSearchFilters = {
  city?: string
  category?: string
  companyName?: string
  service?: string
}

export type MarketplaceStaffPreview = {
  id: string
  name: string
  role: string | null
}

export type MarketplaceOpeningHour = {
  weekday: number
  isOpen: boolean
  startTime: string
  endTime: string
}

export type MarketplaceCompanyProfile = MarketplaceListing & {
  staff: MarketplaceStaffPreview[]
  openingHours: MarketplaceOpeningHour[]
}
