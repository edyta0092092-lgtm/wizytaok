import { NextResponse } from "next/server"

import {
  listMarketplaceCities,
  searchMarketplace,
} from "@/lib/marketplace/search-businesses-server"
import type { MarketplaceSearchFilters } from "@/lib/marketplace/types"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const filters: MarketplaceSearchFilters = {
    city: url.searchParams.get("city") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    companyName: url.searchParams.get("company") ?? undefined,
    service: url.searchParams.get("service") ?? undefined,
  }

  const [listings, cities] = await Promise.all([
    searchMarketplace(filters),
    listMarketplaceCities(),
  ])

  return NextResponse.json({ ok: true, listings, cities })
}
