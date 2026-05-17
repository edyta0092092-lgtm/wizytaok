import type { getServiceRoleClient } from "@/lib/supabase/service-role"

type ServiceAdmin = NonNullable<ReturnType<typeof getServiceRoleClient>>

/** Odczyt kolejki — bez mutacji `appointment_reminders`. */
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
