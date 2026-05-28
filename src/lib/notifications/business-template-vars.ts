import { getPublicAppOrigin } from "@/lib/notifications/public-app-origin"

export type BusinessProfileForTemplates = {
  business_name?: string | null
  phone?: string | null
  contact_phone?: string | null
  slug?: string | null
  business_address?: string | null
}

export function pickBusinessPhone(
  business: BusinessProfileForTemplates | null | undefined,
): string {
  if (!business) return ""
  const phone =
    (typeof business.phone === "string" && business.phone.trim()) ||
    (typeof business.contact_phone === "string" && business.contact_phone.trim()) ||
    ""
  return phone
}

export function buildBookingLink(slug: string | null | undefined): string {
  const origin = getPublicAppOrigin()
  const s = slug?.trim() ?? ""
  return s.length > 0 ? `${origin}/rezerwacje/${encodeURIComponent(s)}` : origin
}

/** Wspólne zmienne firmy dla szablonów SMS/e-mail ({{telefon_firmy}}, {{adres_firmy}}, …). */
export function buildBusinessTemplateVars(
  business: BusinessProfileForTemplates | null | undefined,
  extras?: {
    link_potwierdzenia?: string
    link_anulowania?: string
    link_rezerwacji?: string
  },
): Record<string, string> {
  const linkRezerwacji =
    extras?.link_rezerwacji ?? buildBookingLink(business?.slug ?? null)
  return {
    telefon_firmy: pickBusinessPhone(business),
    nazwa_firmy:
      typeof business?.business_name === "string" ? business.business_name.trim() : "",
    adres_firmy:
      typeof business?.business_address === "string" ? business.business_address.trim() : "",
    link_rezerwacji: linkRezerwacji,
    link_potwierdzenia: extras?.link_potwierdzenia ?? "",
    link_anulowania: extras?.link_anulowania ?? extras?.link_potwierdzenia ?? "",
  }
}
