import type { StaffMember } from "@/types/domain"

/** Scala listy członków zespołu po `id`, uzupełniając pola bez nadpisywania sensownych wartości. */
export function mergeStaffMembersById(...lists: StaffMember[][]): StaffMember[] {
  const map = new Map<string, StaffMember>()
  for (const list of lists) {
    for (const m of list) {
      const id = m.id?.trim()
      if (!id) continue
      const prev = map.get(id)
      if (!prev) {
        map.set(id, { ...m })
        continue
      }
      map.set(id, {
        ...prev,
        ...m,
        name:
          (m.name?.trim() || prev.name?.trim() || "").trim() ||
          prev.name ||
          m.name ||
          "Osoba bez nazwy",
        email: m.email ?? prev.email,
        phone: m.phone ?? prev.phone,
        isActive: m.isActive ?? prev.isActive,
        usesDefaultAvailability: m.usesDefaultAvailability ?? prev.usesDefaultAvailability,
        serviceIds:
          m.serviceIds && m.serviceIds.length > 0 ? m.serviceIds : prev.serviceIds,
      })
    }
  }
  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  )
}
