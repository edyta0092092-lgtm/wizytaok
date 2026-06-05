import type { CustomerCrmRow, CustomerSegmentFilter } from "@/lib/customers/customer-types"

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ")
}

export function filterCustomerRows(
  rows: CustomerCrmRow[],
  query: string,
  segment: CustomerSegmentFilter,
): CustomerCrmRow[] {
  const nq = normalizeQuery(query)

  return rows.filter((row) => {
    if (segment !== "all" && row.segment !== segment) return false
    if (!nq) return true

    const haystack = [
      row.fullName,
      row.firstName,
      row.lastName,
      row.phone,
      row.email,
    ]
      .join(" ")
      .toLowerCase()

    const digits = row.phone.replace(/\D/g, "")
    const queryDigits = nq.replace(/\D/g, "")

    if (queryDigits.length >= 3 && digits.includes(queryDigits)) return true
    return haystack.includes(nq)
  })
}
