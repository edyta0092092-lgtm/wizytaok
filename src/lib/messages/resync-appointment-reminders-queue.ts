import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database"

type Client = SupabaseClient<Database>

/** Po zapisie szablonów przypomnień — uzupełnia kolejkę appointment_reminders (RPC z migracji 065). */
export async function resyncAppointmentRemindersQueue(
  client: Client,
  businessId: string,
): Promise<void> {
  const bid = businessId.trim()
  if (!bid) return
  try {
    const { error } = await client.rpc("sync_appointment_reminders_for_business", {
      p_business_id: bid,
    })
    if (error) {
      console.warn("[resyncAppointmentRemindersQueue]", error.message)
    }
  } catch (err) {
    console.warn("[resyncAppointmentRemindersQueue]", err)
  }
}
