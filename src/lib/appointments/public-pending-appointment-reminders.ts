import type { getServiceRoleClient } from "@/lib/supabase/service-role"

type ServiceAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

/**
 * Czy dla wizyty istnieje jakikolwiek wiersz w `appointment_reminders`
 * ze statusem `pending` lub `processing` (first/second, e-mail/SMS).
 * Odczyt tylko — bez mutacji tabeli.
 */
export async function appointmentHasPendingOrProcessingReminders(
  admin: ServiceAdmin,
  appointmentId: string,
): Promise<boolean | null> {
  const id = appointmentId.trim()
  if (!id) return null

  const { data, error } = await admin
    .from("appointment_reminders")
    .select("id")
    .eq("appointment_id", id)
    .in("status", ["pending", "processing"])
    .limit(1)

  if (error) return null
  return (data?.length ?? 0) > 0
}
