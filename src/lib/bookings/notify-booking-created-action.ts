"use server"

import { sendBookingCreatedNotifications } from "@/lib/notifications/booking-created-server"

/** Natychmiastowe powiadomienie po utworzeniu rezerwacji online (serwer). */
export async function notifyBookingCreatedAfterOnlineBooking(
  confirmationToken: string,
  language: "pl" | "en",
) {
  return sendBookingCreatedNotifications(confirmationToken, language)
}
