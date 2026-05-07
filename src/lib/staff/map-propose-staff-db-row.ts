import type { StaffMember } from "@/types/domain"

/** Mapuje wiersz `staff_members` (lub podobny) na `StaffMember` w formularzu edycji wizyty. */
export function mapProposeStaffDbRow(
  staff: Record<string, unknown>,
  businessId: string,
  serviceKey: string
): StaffMember | null {
  const id = typeof staff.id === "string" ? staff.id.trim() : ""
  if (!id) return null
  const fullName = typeof staff.full_name === "string" ? staff.full_name.trim() : ""
  const legacyName = typeof staff.name === "string" ? staff.name.trim() : ""
  const email = typeof staff.email === "string" ? staff.email.trim() : ""
  const isActive = typeof staff.is_active === "boolean" ? staff.is_active : true
  return {
    id,
    businessId,
    name: fullName || legacyName || email || "Osoba bez nazwy",
    email: email || undefined,
    isActive,
    serviceIds: [serviceKey],
    usesDefaultAvailability: true,
  }
}
