import type { Metadata } from "next"

import { MarketplaceSearchPage } from "@/components/marketplace/marketplace-search-page"

export const metadata: Metadata = {
  title: "Szukaj firm | WizytaOK",
  description:
    "Odkrywaj firmy korzystające z WizytaOK. Filtruj po mieście, kategorii, nazwie i usłudze — umów wizytę online.",
  openGraph: {
    title: "Szukaj firm | WizytaOK",
    description: "Marketplace usług lokalnych z rezerwacją online w WizytaOK.",
    type: "website",
  },
}

export default function SzukajPage() {
  return <MarketplaceSearchPage />
}
