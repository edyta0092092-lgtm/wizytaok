import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { MarketplaceCompanyProfileView } from "@/components/marketplace/marketplace-company-profile"
import { fetchMarketplaceCompanyProfile } from "@/lib/marketplace/fetch-company-profile-server"

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const profile = await fetchMarketplaceCompanyProfile(slug)
  if (!profile) {
    return {
      title: "Firma nie znaleziona | WizytaOK",
      robots: { index: false, follow: false },
    }
  }

  const title = `${profile.name} | WizytaOK`
  const description =
    profile.description.slice(0, 160) ||
    `Umów wizytę w ${profile.name} przez WizytaOK.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/public/company/${profile.slug}`,
    },
  }
}

export default async function PublicCompanyProfilePage({ params }: PageProps) {
  const { slug } = await params
  const profile = await fetchMarketplaceCompanyProfile(slug)
  if (!profile) notFound()

  return <MarketplaceCompanyProfileView profile={profile} />
}
