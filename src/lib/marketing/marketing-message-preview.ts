import { splitCustomerName } from "@/lib/customers/customer-name"
import type { CustomerCrmRow } from "@/lib/customers/customer-types"

export function renderMarketingMessagePreview(
  template: string,
  sample: CustomerCrmRow | null,
  businessName: string,
): string {
  const body = template.trim()
  if (!body) return ""

  const { firstName, lastName } = sample
    ? splitCustomerName(sample.fullName)
    : { firstName: "Jan", lastName: "Kowalski" }

  return body
    .replaceAll("{imie}", firstName || "—")
    .replaceAll("{nazwisko}", lastName || "—")
    .replaceAll("{klient}", sample?.fullName?.trim() || "Jan Kowalski")
    .replaceAll("{firma}", businessName.trim() || "Twoja firma")
}
